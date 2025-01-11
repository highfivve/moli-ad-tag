import { IAssetLoaderService } from '../util/assetLoaderService';
import { getDefaultLogger, getLogger, ProxyLogger } from '../util/logging';
import { Moli } from '../types/moli';
import {
  AdPipeline,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from './adPipeline';
import {
  noopReportingService,
  reportingPrepareRequestAds,
  ReportingService
} from './reportingService';
import { createPerformanceService } from '../util/performanceService';
import {
  gptConfigure,
  gptConsentKeyValue,
  gptDefineSlots,
  gptDestroyAdSlots,
  gptInit,
  gptLDeviceLabelKeyValue,
  gptRequestAds,
  gptResetTargeting
} from './googleAdManager';
import domready from '../util/domready';
import {
  prebidConfigure,
  prebidDefineSlots,
  prebidInit,
  prebidPrepareRequestAds,
  prebidRemoveAdUnits,
  prebidRenderAds,
  prebidRequestBids
} from './prebid';
import {
  a9Configure,
  a9Init,
  a9RequestBids,
  a9ClearTargetingStep,
  a9PublisherAudiences
} from './a9';
import { flatten, isNotNull } from '../util/arrayUtils';
import { passbackPrepareRequestAds } from './passback';
import { PassbackService } from './passbackService';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { executeDebugDelay, getDebugDelayFromLocalStorage } from '../util/debugDelay';
import { GlobalAuctionContext } from './globalAuctionContext';
import { LabelConfigService } from './labelConfigService';

/**
 * @internal
 */
export class AdService {
  /**
   * Access to a logger
   */
  private readonly logger: ProxyLogger;

  /**
   * increments with every call to requestAds
   */
  private requestAdsCalls: number = 0;

  /**
   * TODO add an API to push steps into the pipeline via the Moli API
   *      this will allow us to configure arbitrary things via modules
   *      in the ad request lifecycle
   */
  private adPipeline: AdPipeline = new AdPipeline(
    {
      init: [() => Promise.reject('AdPipeline not initialized yet')],
      configure: [],
      defineSlots: () => Promise.resolve([]),
      prepareRequestAds: [],
      requestBids: [],
      requestAds: () => Promise.resolve()
    },
    getDefaultLogger(),
    this.window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow,
    noopReportingService,
    new GlobalAuctionContext(
      this.window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow
    )
  );

  private static getEnvironment(config: Moli.MoliConfig): Moli.Environment {
    return config.environment || 'production';
  }

  /**
   *
   * @param assetService
   * @param window
   * @param adPipelineConfig only for testing purpose at this point. This configuration will be overridden by
   *        a call to initialize. This should not be the API for extending the pipeline!
   */
  constructor(
    private readonly assetService: IAssetLoaderService,
    private readonly window: Window,
    private readonly adPipelineConfig?: IAdPipelineConfiguration
  ) {
    // initialize the logger with a default one
    this.logger = new ProxyLogger(getDefaultLogger());
    if (adPipelineConfig) {
      this.adPipeline = new AdPipeline(
        adPipelineConfig,
        this.logger,
        window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow,
        noopReportingService,
        new GlobalAuctionContext(
          window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow
        )
      );
    }
  }

  /**
   * Must only be called once.
   *
   * This step configures
   * - logging
   * - services
   * - ad pipeline
   *
   *
   * @param config
   * @param isSinglePageApp
   */
  public initialize = (
    config: Readonly<Moli.MoliConfig>,
    isSinglePageApp: boolean
  ): Promise<Readonly<Moli.MoliConfig>> => {
    const env = AdService.getEnvironment(config);
    const adServer = config.adServer || 'gam';
    const isGam = adServer === 'gam';
    // 1. setup all services
    this.logger.setLogger(getLogger(config, this.window));
    this.logger.debug(
      'AdService',
      `Initializing with environment ${env} and ad server ${adServer}`
    );

    // only create performance marks if configured
    const reportingService =
      isGam && config.reporting && config.reporting.sampleRate > 0
        ? new ReportingService(
            createPerformanceService(this.window),
            config.reporting,
            this.logger,
            env,
            this.window as Window & googletag.IGoogleTagWindow
          )
        : noopReportingService;

    // 2. build the AdPipeline
    const init: InitStep[] = isGam ? [gptInit(this.assetService)] : [];

    const configure: ConfigureStep[] = isGam ? [gptConfigure(config)] : [];

    if (isGam && isSinglePageApp) {
      configure.push(gptDestroyAdSlots(), gptResetTargeting());
    }

    const prepareRequestAds: PrepareRequestAdsStep[] = [];
    if (isGam) {
      prepareRequestAds.push(
        gptLDeviceLabelKeyValue(),
        gptConsentKeyValue(),
        passbackPrepareRequestAds(
          new PassbackService(this.logger, this.window as Window & googletag.IGoogleTagWindow)
        )
      );
    }

    // only add reporting if there's a reporter
    if (config.reporting) {
      prepareRequestAds.push(reportingPrepareRequestAds(reportingService));
    }

    const requestBids: RequestBidsStep[] = [];

    // prebid
    if (config.prebid && env === 'production') {
      init.push(prebidInit(this.assetService));

      configure.push(prebidConfigure(config.prebid, config.schain));
      if (isSinglePageApp) {
        configure.push(prebidRemoveAdUnits(config.prebid));
      }
      prepareRequestAds.push(prebidPrepareRequestAds(config.prebid));
      requestBids.push(prebidRequestBids(config.prebid, adServer, config.targeting));
    }

    // amazon a9
    if (config.a9 && env === 'production' && isGam) {
      init.push(a9Init(config.a9, this.assetService));
      configure.push(a9Configure(config.a9, config.schain));
      configure.push(a9PublisherAudiences(config.a9));
      prepareRequestAds.push(a9ClearTargetingStep());
      requestBids.push(a9RequestBids(config.a9));
    }

    // add additional steps if configured
    if (config.pipeline) {
      init.push(...config.pipeline.initSteps);
      configure.push(...config.pipeline.configureSteps);
      prepareRequestAds.push(...config.pipeline.prepareRequestAdsSteps);
    }

    // delay ad requests for debugging
    if (env === 'test') {
      const debugDelay = getDebugDelayFromLocalStorage(this.window);
      if (debugDelay) {
        configure.push(() => executeDebugDelay(this.window, debugDelay));
      }
    }

    this.adPipeline = new AdPipeline(
      {
        init,
        configure,
        defineSlots: isGam ? gptDefineSlots() : prebidDefineSlots(),
        prepareRequestAds,
        requestBids,
        requestAds: isGam ? gptRequestAds() : prebidRenderAds()
      },
      this.logger,
      this.window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow,
      reportingService,
      new GlobalAuctionContext(
        this.window as Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow,
        config.globalAuctionContext
      )
    );

    return new Promise<Readonly<Moli.MoliConfig>>(resolve => {
      domready(this.window, () => {
        this.logger.debug('DOM', 'dom ready');
        resolve(config);
      });
    });
  };

  /**
   *
   * @param config
   * @param refreshSlots a list of ad slots that are already manually refreshed via the `moli.refreshAdSlot` API
   *         and can be part of the requestAds cycle
   * @param refreshInfiniteSlots a list of infinite ad slots that are already manually refreshed via the `moli.refreshInfiniteAdSlot` API
   *         and can be part of the requestAds cycle
   */
  public requestAds = async (
    config: Readonly<Moli.MoliConfig>,
    refreshSlots: string[],
    refreshInfiniteSlots: Moli.state.IRefreshInfiniteSlot[]
  ): Promise<Moli.AdSlot[]> => {
    this.requestAdsCalls = this.requestAdsCalls + 1;
    this.logger.info('AdService', `RequestAds[${this.requestAdsCalls}]`, refreshSlots);
    try {
      const immediatelyLoadedSlots: Moli.AdSlot[] = config.slots
        .map(slot => {
          if (this.isManualSlot(slot)) {
            // only load the slot immediately if it's available in the refreshSlots array
            return refreshSlots.some(domId => domId === slot.domId) ? slot : null;
          } else if (this.isInfiniteSlot(slot)) {
            return refreshInfiniteSlots.some(
              infiniteSlot => infiniteSlot.artificialDomId === slot.domId
            )
              ? slot
              : null;
          } else if (this.isBackfillSlot(slot)) {
            // backfill slots must never be eagerly loaded
            return null;
          } else {
            return slot;
          }
        })
        .filter(isNotNull)
        .filter(this.isSlotAvailable);

      if (config.buckets?.enabled) {
        // create buckets
        const buckets = new Map<string, Moli.AdSlot[]>();
        immediatelyLoadedSlots.forEach(slot => {
          const bucket = this.getBucketName(
            slot.behaviour.bucket,
            config.labelSizeConfig ?? [],
            config.targeting?.labels ?? []
          );
          const slots = buckets.get(bucket);
          if (slots) {
            slots.push(slot);
          } else {
            buckets.set(bucket, [slot]);
          }
        });

        const arr = await Promise.all(
          Array.from(buckets.entries()).map(([bucketId, bucketSlots]) => {
            this.logger.debug('AdPipeline', `running bucket ${bucketId}, slots:`, bucketSlots);
            return this.adPipeline
              .run(bucketSlots, config, this.requestAdsCalls)
              .then(() => bucketSlots);
          })
        );
        return flatten(arr);
      } else {
        await this.adPipeline.run(immediatelyLoadedSlots, config, this.requestAdsCalls);
        return immediatelyLoadedSlots;
      }
    } catch (e) {
      this.logger.error('AdPipeline', 'slot filtering failed', e);
      return Promise.reject(e);
    }
  };

  public refreshAdSlots(
    domIds: string[],
    config: Moli.MoliConfig,
    options?: Moli.RefreshAdSlotsOptions
  ): Promise<void> {
    if (domIds.length === 0) {
      return Promise.resolve();
    }

    const { loaded } = options || { loaded: 'manual' };

    const availableSlots = config.slots
      .filter(slot => slot.behaviour.loaded === loaded || slot.behaviour.loaded === 'infinite')
      .filter(slot => domIds.some(domId => domId === slot.domId))
      .filter(this.isSlotAvailable);

    if (domIds.length !== availableSlots.length) {
      const slotsInConfigOnly = availableSlots.filter(slot =>
        domIds.every(domId => domId !== slot.domId)
      );
      const slotsOnPageDomOnly = domIds.filter(domId =>
        availableSlots.every(slot => slot.domId !== domId)
      );

      if (slotsInConfigOnly.length) {
        this.logger.warn(
          'AdService',
          'The following slots do not exist on the page DOM.',
          slotsInConfigOnly
        );
      }
      if (slotsOnPageDomOnly.length) {
        this.logger.warn(
          'AdService',
          'The following slots are not configured in the ad-tag config.',
          slotsInConfigOnly
        );
      }
    }

    this.logger.debug('AdService', 'refresh ad slots', availableSlots, config.targeting);
    return this.adPipeline.run(availableSlots, config, this.requestAdsCalls);
  }

  public refreshBucket(bucket: string, config: Moli.MoliConfig): Promise<void> {
    if (!config.buckets?.enabled) {
      return Promise.resolve();
    }
    const manualSlots = config.slots.filter(this.isManualSlot);
    const availableSlotsInBucket = manualSlots.filter(slot => {
      const slotBucket = this.getBucketName(
        slot.behaviour.bucket,
        config.labelSizeConfig ?? [],
        config.targeting?.labels ?? []
      );
      return slotBucket === bucket;
    });

    this.logger.debug('AdService', 'refresh ad buckets', availableSlotsInBucket, config.targeting);
    return this.adPipeline.run(availableSlotsInBucket, config, this.requestAdsCalls, bucket);
  }

  /**
   * Returns the underlying ad pipeline.
   */
  public getAdPipeline = (): AdPipeline => {
    return this.adPipeline;
  };

  public setLogger = (logger: Moli.MoliLogger): void => {
    this.logger.setLogger(logger);
  };

  private isManualSlot = (
    slot: Moli.AdSlot
  ): slot is Moli.AdSlot & { behaviour: Moli.behaviour.Manual } => {
    return slot.behaviour.loaded === 'manual';
  };

  private isInfiniteSlot = (
    slot: Moli.AdSlot
  ): slot is Moli.AdSlot & { behaviour: Moli.behaviour.Infinite } => {
    return slot.behaviour.loaded === 'infinite';
  };

  private isBackfillSlot = (
    slot: Moli.AdSlot
  ): slot is Moli.AdSlot & { behaviour: Moli.behaviour.Backfill } => {
    return slot.behaviour.loaded === 'backfill';
  };

  private isSlotAvailable = (slot: Moli.AdSlot): boolean => {
    return (
      !!this.window.document.getElementById(slot.domId) ||
      // web interstitials and web anchors don't require a dom element
      slot.position === 'out-of-page-interstitial' ||
      slot.position === 'out-of-page-top-anchor' ||
      slot.position === 'out-of-page-bottom-anchor'
    );
  };

  private getBucketName = (
    bucket: Moli.bucket.AdSlotBucket | undefined,
    labelSizeConfig: Moli.LabelSizeConfigEntry[],
    extraLabels: string[]
  ): string => {
    // if no bucket is defined, return the default bucket
    if (!bucket) {
      return 'default';
    }
    // a single bucket for all devices
    if (typeof bucket === 'string') {
      return bucket;
    }
    const device = new LabelConfigService(
      labelSizeConfig,
      extraLabels,
      this.window
    ).getDeviceLabel();

    return bucket[device] || 'default';
  };
}
