import { IAssetLoaderService } from '../util/assetLoaderService';
import { getDefaultLogger, getLogger, ProxyLogger } from '../util/logging';
import { MoliRuntime } from '../types/moliRuntime';
import {
  AdPipeline,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from './adPipeline';
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
  prebidClearAuction,
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
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { executeDebugDelay, getDebugDelayFromLocalStorage } from '../util/debugDelay';
import { createGlobalAuctionContext } from './globalAuctionContext';
import { AdSlot, behaviour, bucket, Device, Environment, MoliConfig } from '../types/moliConfig';
import { getDeviceLabel } from 'ad-tag/ads/labelConfigService';
import { EventService } from 'ad-tag/ads/eventService';
import { bridgeInitStep } from 'ad-tag/ads/bridge/bridge';

/**
 * All relevant information about the global window
 */
type AdServiceWindow = Window &
  MoliRuntime.MoliWindow &
  googletag.IGoogleTagWindow &
  prebidjs.IPrebidjsWindow &
  Pick<typeof globalThis, 'Date' | 'console'>;

const isManualSlot = (slot: AdSlot): slot is AdSlot & { behaviour: behaviour.Manual } => {
  return slot.behaviour.loaded === 'manual';
};

const isInfiniteSlot = (slot: AdSlot): slot is AdSlot & { behaviour: behaviour.Infinite } => {
  return slot.behaviour.loaded === 'infinite';
};

const isBackfillSlot = (slot: AdSlot): slot is AdSlot & { behaviour: behaviour.Backfill } => {
  return slot.behaviour.loaded === 'backfill';
};

const isSlotAvailable =
  (_window: Window) =>
  (slot: AdSlot): boolean => {
    return (
      !!_window.document.getElementById(slot.domId) ||
      // this is a custom position defined by the ad tag library. A temporary div is created
      // if it does not exist to facilitate the prebid auction
      slot.position === 'interstitial' ||
      // gpt.js position for custom out-of-page formats. A DOM element is required, which we create
      // on demand if it is missing
      slot.position === 'out-of-page' ||
      // web interstitials and web anchors don't require a dom element
      slot.position === 'out-of-page-interstitial' ||
      slot.position === 'out-of-page-top-anchor' ||
      slot.position === 'out-of-page-bottom-anchor'
    );
  };

const getBucketName = (bucket: bucket.AdSlotBucket | undefined, device: Device): string => {
  // if no bucket is defined, return the default bucket
  if (!bucket) {
    return 'default';
  }
  // a single bucket for all devices
  if (typeof bucket === 'string') {
    return bucket;
  }
  return bucket[device] || 'default';
};

const slotsInBucket = (
  _window: Window,
  config: MoliConfig,
  device: Device,
  bucket: string,
  options?: MoliRuntime.RefreshAdSlotsOptions
): AdSlot[] => {
  const { loaded } = { ...{ loaded: 'manual' }, ...options };
  return (
    config.slots
      .filter(isSlotAvailable(_window))
      .filter(slot => {
        const slotBucket = getBucketName(slot.behaviour.bucket, device);
        return (
          slotBucket === bucket &&
          (slot.behaviour.loaded === loaded || slot.behaviour.loaded === 'infinite')
        );
      })
      // if sizesOverride is provided, override the sizes of the slots
      .map(slot => (options?.sizesOverride ? { ...slot, sizes: options.sizesOverride } : slot))
  );
};

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
    this.window as AdServiceWindow,
    createGlobalAuctionContext(
      this.window as AdServiceWindow,
      getDefaultLogger(),
      this.eventService
    )
  );

  private static getEnvironment(config: MoliRuntime.MoliRuntimeConfig): Environment {
    return config.environment || 'production';
  }

  /**
   *
   * @param assetService
   * @param eventService
   * @param window
   * @param adPipelineConfig only for testing purpose at this point. This configuration will be overridden by
   *        a call to initialize. This should not be the API for extending the pipeline!
   */
  constructor(
    private readonly assetService: IAssetLoaderService,
    private readonly eventService: EventService,
    private readonly window: Window,
    private readonly adPipelineConfig?: IAdPipelineConfiguration
  ) {
    // initialize the logger with a default one
    this.logger = new ProxyLogger(getDefaultLogger());
    if (adPipelineConfig) {
      this.adPipeline = new AdPipeline(
        adPipelineConfig,
        this.logger,
        window as AdServiceWindow,
        createGlobalAuctionContext(window as AdServiceWindow, this.logger, this.eventService)
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
   * @param runtimeConfig
   */
  public initialize = (
    config: Readonly<MoliConfig>,
    runtimeConfig: Readonly<MoliRuntime.MoliRuntimeConfig>
  ): Promise<Readonly<MoliConfig>> => {
    const env = AdService.getEnvironment(runtimeConfig);
    const adServer = config.adServer || 'gam';
    const isGam = adServer === 'gam';
    const isSinglePageApp = config.spa?.enabled === true;
    // 1. setup all services
    this.logger.setLogger(getLogger(runtimeConfig, this.window));
    this.logger.debug(
      'AdService',
      `Initializing with environment ${env} and ad server ${adServer}`
    );

    // 2. build the AdPipeline
    const init: InitStep[] = isGam ? [gptInit(), bridgeInitStep()] : [];

    const configure: ConfigureStep[] = isGam ? [gptConfigure()] : [];

    if (isGam && isSinglePageApp) {
      configure.push(gptDestroyAdSlots(), gptResetTargeting());
    }

    const prepareRequestAds: PrepareRequestAdsStep[] = [];
    if (isGam) {
      prepareRequestAds.push(gptLDeviceLabelKeyValue(), gptConsentKeyValue());
    }

    const requestBids: RequestBidsStep[] = [];

    // prebid
    if (config.prebid && env === 'production') {
      init.push(prebidInit(this.assetService));

      configure.push(prebidConfigure(config.prebid, config.schain));
      if (isSinglePageApp) {
        configure.push(prebidRemoveAdUnits(config.prebid));
        if (config.prebid.clearAllAuctions) {
          configure.push(prebidClearAuction());
        }
      }
      prepareRequestAds.push(prebidPrepareRequestAds(config.prebid));
      requestBids.push(prebidRequestBids(config.prebid, adServer));
    }

    // amazon a9
    if (config.a9 && config.a9.enabled !== false && env === 'production' && isGam) {
      init.push(a9Init(config.a9, this.assetService));
      configure.push(a9Configure(config.a9, config.schain));
      configure.push(a9PublisherAudiences(config.a9, runtimeConfig.audience));
      prepareRequestAds.push(a9ClearTargetingStep());
      requestBids.push(a9RequestBids(config.a9));
    }

    // create global auction context and add it to the pipeline
    const globalAuctionContext = createGlobalAuctionContext(
      this.window as AdServiceWindow,
      this.logger,
      this.eventService,
      config.globalAuctionContext
    );
    configure.push(globalAuctionContext.configureStep());

    // add module steps to pipeline
    init.push(...runtimeConfig.adPipelineConfig.initSteps);
    configure.push(...runtimeConfig.adPipelineConfig.configureSteps);
    prepareRequestAds.push(...runtimeConfig.adPipelineConfig.prepareRequestAdsSteps);
    requestBids.push(...runtimeConfig.adPipelineConfig.requestBidsSteps);

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
      this.window as AdServiceWindow,
      globalAuctionContext
    );

    return new Promise<Readonly<MoliConfig>>(resolve => {
      domready(this.window, () => {
        this.logger.debug('DOM', 'dom ready');
        resolve(config);
      });
    });
  };

  /**
   *
   * @param config
   * @param runtimeConfig contains configuration and APIs call made through the JS API. For instance:
   *        Contains refreshSlots - a list of ad slots that are already manually refreshed via the `moli.refreshAdSlot` API
   *        and can be part of the requestAds cycle
   *        Contains refreshInfiniteSlots - a list of infinite ad slots that are already manually refreshed via the `moli.refreshInfiniteAdSlot` API
   *        and can be part of the requestAds cycle
   */
  public requestAds = async (
    config: Readonly<MoliConfig>,
    runtimeConfig: Readonly<MoliRuntime.MoliRuntimeConfig>
  ): Promise<AdSlot[]> => {
    this.requestAdsCalls = this.requestAdsCalls + 1;
    const { refreshSlots, refreshInfiniteSlots, refreshBuckets } = runtimeConfig;
    const device = getDeviceLabel(
      this.window,
      runtimeConfig,
      config.labelSizeConfig,
      config.targeting
    );

    const refreshSlotsFromBuckets = refreshBuckets.flatMap(bucket =>
      slotsInBucket(this.window, config, device, bucket.bucket, bucket.options).map(
        slot => slot.domId
      )
    );
    this.logger.info(
      'AdService',
      `RequestAds[${this.requestAdsCalls}]`,
      refreshSlots,
      refreshBuckets
    );
    this.eventService.emit('beforeRequestAds', { runtimeConfig: runtimeConfig });
    try {
      const immediatelyLoadedSlots: AdSlot[] = config.slots
        .map(slot => {
          if (isManualSlot(slot)) {
            // only load the slot immediately if it's available in the refreshSlots array
            return refreshSlots.includes(slot.domId) || refreshSlotsFromBuckets.includes(slot.domId)
              ? slot
              : null;
          } else if (isInfiniteSlot(slot)) {
            return refreshInfiniteSlots.some(
              infiniteSlot => infiniteSlot.artificialDomId === slot.domId
            )
              ? slot
              : null;
          } else if (isBackfillSlot(slot)) {
            // backfill slots must never be eagerly loaded
            return null;
          } else {
            return slot;
          }
        })
        .filter(isNotNull)
        .filter(isSlotAvailable(this.window));

      if (config.buckets?.enabled) {
        // create buckets
        const buckets = new Map<string, AdSlot[]>();
        immediatelyLoadedSlots.forEach(slot => {
          const bucket = getBucketName(slot.behaviour.bucket, device);
          const slots = buckets.get(bucket);
          if (slots) {
            slots.push(slot);
          } else {
            buckets.set(bucket, [slot]);
          }
        });

        const result =
          buckets.size === 0
            ? this.adPipeline.run([], config, runtimeConfig, this.requestAdsCalls).then(() => [])
            : Promise.all(
                Array.from(buckets.entries()).map(([bucketId, bucketSlots]) => {
                  this.logger.debug(
                    'AdPipeline',
                    `running bucket ${bucketId}, slots:`,
                    bucketSlots
                  );
                  return this.adPipeline
                    .run(bucketSlots, config, runtimeConfig, this.requestAdsCalls)
                    .then(() => bucketSlots);
                })
              );
        this.eventService.emit('afterRequestAds', { state: 'finished' });
        return result.then(slots => flatten(slots));
      } else {
        await this.adPipeline.run(
          immediatelyLoadedSlots,
          config,
          runtimeConfig,
          this.requestAdsCalls
        );
        this.eventService.emit('afterRequestAds', { state: 'finished' });
        return immediatelyLoadedSlots;
      }
    } catch (e) {
      this.logger.error('AdPipeline', 'slot filtering failed', e);
      this.eventService.emit('afterRequestAds', { state: 'error' });
      return Promise.reject(e);
    }
  };

  public refreshAdSlots(
    domIds: string[],
    config: MoliConfig,
    runtimeConfig: MoliRuntime.MoliRuntimeConfig,
    options?: MoliRuntime.RefreshAdSlotsOptions
  ): Promise<void> {
    if (domIds.length === 0) {
      return Promise.resolve();
    }

    const { loaded } = { ...{ loaded: 'manual' }, ...options };

    const allowedLoadingBehaviours = new Set<behaviour.ISlotLoading['loaded']>(['infinite']);
    if (loaded === 'eager') {
      allowedLoadingBehaviours.add('manual');
      allowedLoadingBehaviours.add('eager');
    } else {
      allowedLoadingBehaviours.add(loaded as behaviour.ISlotLoading['loaded']);
    }

    const availableSlots = config.slots
      .filter(
        slot =>
          domIds.some(domId => domId === slot.domId) &&
          allowedLoadingBehaviours.has(slot.behaviour.loaded)
      )
      .filter(isSlotAvailable(this.window))
      // if sizesOverride is provided, override the sizes of the slots
      .map(slot => (options?.sizesOverride ? { ...slot, sizes: options.sizesOverride } : slot));

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

    this.logger.debug('AdService', 'refresh ad slots', availableSlots);
    return this.adPipeline.run(availableSlots, config, runtimeConfig, this.requestAdsCalls, {
      options
    });
  }

  public refreshBucket(
    bucket: string,
    config: MoliConfig,
    runtimeConfig: MoliRuntime.MoliRuntimeConfig,
    options?: MoliRuntime.RefreshAdSlotsOptions
  ): Promise<void> {
    if (!config.buckets?.enabled) {
      return Promise.resolve();
    }
    const device = getDeviceLabel(
      this.window,
      runtimeConfig,
      config.labelSizeConfig,
      config.targeting
    );
    const availableSlotsInBucket = slotsInBucket(this.window, config, device, bucket, options);

    if (availableSlotsInBucket.length === 0) {
      this.logger.warn('AdService', 'No slots found in bucket', bucket);
      return Promise.resolve();
    }

    this.logger.debug('AdService', 'refresh ad buckets', availableSlotsInBucket, config.targeting);
    return this.adPipeline.run(
      availableSlotsInBucket,
      config,
      runtimeConfig,
      this.requestAdsCalls,
      { bucketName: bucket, options: options }
    );
  }

  /**
   * Returns the underlying ad pipeline.
   */
  public getAdPipeline = (): AdPipeline => {
    return this.adPipeline;
  };

  public setLogger = (logger: MoliRuntime.MoliLogger): void => {
    this.logger.setLogger(logger);
  };
}
