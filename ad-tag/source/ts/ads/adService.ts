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
import { SlotEventService, slotEventServiceConfigure } from './slotEventService';
import { noopReportingService, reportingConfigure, ReportingService } from './reportingService';
import { createPerformanceService } from '../util/performanceService';
import { YieldOptimizationService } from './yieldOptimizationService';
import {
  gptConfigure,
  gptDefineSlots,
  gptDestroyAdSlots,
  gptInit,
  gptRequestAds,
  gptResetTargeting
} from './googleAdManager';
import domready from '../util/domready';
import {
  prebidConfigure,
  prebidInit,
  prebidPrepareRequestAds, prebidRemoveAdUnits,
  prebidRemoveHbKeyValues,
  prebidRequestBids
} from './prebid';
import { a9Configure, a9Init, a9RequestBids } from './a9';
import { isNotNull } from '../util/arrayUtils';
import { createLazyLoader } from './lazyLoading';
import { createRefreshListener } from './refreshAd';
import { consentConfigureGpt } from './consent';
import { yieldOptimizationPrepareRequestAds } from './yieldOptimization';
import { passbackPrepareRequestAds } from './passback';
import { PassbackService } from './passbackService';


export class AdService {

  /**
   * Access to a logger
   */
  private logger: ProxyLogger;

  /**
   * Slot event management
   */
  private readonly slotEventService: SlotEventService;

  /**
   * TODO add an API to push steps into the pipeline via the Moli API
   *      this will allow us to configure arbitrary things via modules
   *      in the ad request lifecycle
   */
  private adPipeline: AdPipeline = new AdPipeline({
    init: [ () => Promise.reject('AdPipeline not initialized yet') ],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()

  }, this.logger, this.window, noopReportingService, this.slotEventService);

  /**
   *
   * @param assetService
   * @param window
   * @param adPipelineConfig only for testing purposes at this point. This configuration will be overriden by
   *        a call to initialize. This should not be the API for extending the pipeline!
   */
  constructor(private readonly assetService: IAssetLoaderService,
              private readonly window: Window,
              private readonly adPipelineConfig?: IAdPipelineConfiguration
  ) {    // initialize the logger with a default one
    this.logger = new ProxyLogger(getDefaultLogger());
    this.slotEventService = new SlotEventService(this.logger);
    if (adPipelineConfig) {
      this.adPipeline = new AdPipeline(adPipelineConfig, this.logger, window, noopReportingService, this.slotEventService);
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
  public initialize = (config: Readonly<Moli.MoliConfig>, isSinglePageApp: boolean): Promise<Readonly<Moli.MoliConfig>> => {
    const env = this.getEnvironment(config);
    // 1. setup all services
    this.logger.setLogger(getLogger(config, this.window));
    this.logger.debug('AdService', `Initializing with environment ${env}`);

    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };
    const reportingService = new ReportingService(
      createPerformanceService(this.window),
      this.slotEventService, reportingConfig,
      this.logger,
      env,
      this.window
    );

    // 2. build the AdPipeline
    const init: InitStep[] = [
      this.awaitDomReady(),
      gptInit()
    ];

    const configure: ConfigureStep[] = [
      gptConfigure(config),
      reportingConfigure(reportingService),
      slotEventServiceConfigure(this.slotEventService)
    ];

    if (isSinglePageApp) {
      configure.push(gptDestroyAdSlots(), gptResetTargeting());
    }

    if (config.consent.cmp) {
      configure.push(consentConfigureGpt(config.consent.cmp));
    }

    const prepareRequestAds: PrepareRequestAdsStep[] = [
      passbackPrepareRequestAds(new PassbackService(this.logger, this.window)),
      yieldOptimizationPrepareRequestAds(new YieldOptimizationService(config.yieldOptimization, this.assetService, this.logger))
    ];

    const requestBids: RequestBidsStep[] = [];

    // prebid
    if (config.prebid && env === 'production') {
      init.push(prebidInit());

      configure.push(prebidConfigure(config.prebid));
      if (isSinglePageApp) {
        configure.push(prebidRemoveAdUnits());
      }
      prepareRequestAds.push(prebidRemoveHbKeyValues(), prebidPrepareRequestAds());
      requestBids.push(prebidRequestBids(config.prebid, config.targeting));
    }

    // amazon a9
    if (config.a9 && env === 'production') {
      init.push(a9Init(config.a9, this.assetService));
      configure.push(a9Configure(config.a9));
      requestBids.push(a9RequestBids());
    }

    // add additional steps if configured
    if (config.pipeline) {
      configure.push(...config.pipeline.configureSteps);
      prepareRequestAds.push(...config.pipeline.prepareRequestAdsSteps);
    }

    this.adPipeline = new AdPipeline({
      init,
      configure,
      defineSlots: gptDefineSlots(),
      prepareRequestAds,
      requestBids,
      requestAds: gptRequestAds()
    }, this.logger, this.window, reportingService, this.slotEventService);

    return Promise.resolve(config);
  };


  public requestAds = (config: Readonly<Moli.MoliConfig>): Promise<Moli.AdSlot[]> => {
    this.logger.info('AdService', 'RequestAds');
    try {
      const immediatelyLoadedSlots: Moli.AdSlot[] = config.slots
        .map(slot => {
          if (this.isLazySlot(slot)) {
            // initialize lazy slot
            createLazyLoader(slot.behaviour.trigger, this.slotEventService, this.window).onLoad()
              .then(() => {
                if (this.isSlotAvailable(slot)) {
                  return Promise.resolve();
                }
                const message = `lazy slot dom element not available: ${slot.adUnitPath} / ${slot.domId}`;
                this.logger.error('AdService', message);
                return Promise.reject(message);
              })
              .then(() => this.adPipeline.run([ slot ], config));
            return null;
          } else if (this.isRefreshableAdSlot(slot)) {
            // initialize lazy refreshable slot
            createRefreshListener(slot.behaviour.trigger, slot.behaviour.throttle, this.slotEventService, this.window)
              .addAdRefreshListener(() => this.adPipeline.run([ slot ], config));

            // if the slot should be lazy loaded don't return it
            return slot.behaviour.lazy ? null : slot;
          } else {
            return slot;
          }
        })
        .filter(isNotNull)
        .filter(this.isSlotAvailable);
      return this.adPipeline.run(immediatelyLoadedSlots, config).then(() => immediatelyLoadedSlots);
    } catch (e) {
      this.logger.error('AdPipeline', 'slot filtering failed', e);
      return Promise.reject(e);
    }
  };

  /**
   * Returns the underlying ad pipeline.
   */
  public getAdPipeline = (): AdPipeline => {
    return this.adPipeline;
  }

  public setLogger = (logger: Moli.MoliLogger): void => {
    this.logger.setLogger(logger);
  }

  private getEnvironment(config: Moli.MoliConfig): Moli.Environment {
    return config.environment || 'production';
  }

  private awaitDomReady = (): InitStep => {
    const fn = () => new Promise<void>(resolve => {
      domready(this.window, resolve);
    }).then(() => this.logger.debug('DOM', 'dom ready'));
    Object.defineProperty(fn, 'name', { value: 'await-dom-ready' });
    return fn;
  };

  private isLazySlot = (slot: Moli.AdSlot): slot is Moli.LazyAdSlot => {
    return slot.behaviour.loaded === 'lazy';
  }

  private isRefreshableAdSlot = (slot: Moli.AdSlot): slot is Moli.RefreshableAdSlot => {
    return slot.behaviour.loaded === 'refreshable';
  }

  private isSlotAvailable = (slot: Moli.AdSlot): boolean => {
    return !!this.window.document.getElementById(slot.domId);
  }

}
