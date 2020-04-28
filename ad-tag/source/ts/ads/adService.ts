import { IAssetLoaderService } from '../util/assetLoaderService';
import { getDefaultLogger, getLogger } from '../util/logging';
import { Moli } from '../types/moli';
import { AdPipeline, ConfigureStep, InitStep, PrepareRequestAdsStep, RequestBidsStep } from './adPipeline';
import { SlotEventService } from './slotEventService';
import { ReportingService } from './reportingService';
import { createPerformanceService } from '../util/performanceService';
import { YieldOptimizationService } from './yieldOptimizationService';
import { gptConfigure, gptDefineSlots, gptDestroyAdSlots, gptInit, gptRequestAds } from './googleAdManager';
import domready from '../util/domready';
import {
  prebidConfigure,
  prebidInit,
  prebidPrepareRequestAds, prebidRemoveAdUnits,
  prebidRemoveHbKeyValues,
  prebidRequestBids
} from './prebid';
import { a9Configure, a9Init, a9RemoveKeyValues, a9RequestBids } from './a9';
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
  private logger: Moli.MoliLogger;

  /**
   * Slot event management
   */
  private slotEventService = new SlotEventService(this.logger);

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

  }, this.logger, 'test', this.window, null as any, this.slotEventService);

  constructor(private assetService: IAssetLoaderService,
              private window: Window) {    // initialize the logger with a default one
    this.logger = getDefaultLogger();
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
    this.logger = getLogger(config, this.window);
    this.logger.debug('AdService', `Initializing with environment ${env}`);

    // slot and reporting service are not usable until `initialize()` is called on both services


    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };
    const reportingService = new ReportingService(
      createPerformanceService(this.window), this.slotEventService, reportingConfig, this.logger, this.getEnvironment(config), this.window
    );

    // 2. build the AdPipeline
    const init: InitStep[] = [
      this.awaitDomReady,
      gptInit()
    ];

    if (isSinglePageApp) {
      init.push(gptDestroyAdSlots());
    }

    const configure: ConfigureStep[] = [
      gptConfigure(config)
    ];

    if (config.consent.cmp) {
      configure.push(consentConfigureGpt(config.consent.cmp));
    }

    const prepareRequestAds: PrepareRequestAdsStep[] = [
      passbackPrepareRequestAds(new PassbackService(this.window.googletag, this.logger, this.window)),
      yieldOptimizationPrepareRequestAds(new YieldOptimizationService(config.yieldOptimization, this.assetService, this.logger))
    ];

    const requestBids: RequestBidsStep[] = [];

    // prebid
    if (config.prebid) {
      init.push(prebidInit());
      if (isSinglePageApp) {
        init.push(prebidRemoveAdUnits());
      }

      configure.push(prebidConfigure(config.prebid, config.targeting));
      prepareRequestAds.push(prebidRemoveHbKeyValues(), prebidPrepareRequestAds(config.prebid, config.targeting));
      requestBids.push(prebidRequestBids(config.prebid, config.targeting));
    }

    // amazon a9
    if (config.a9) {
      init.push(a9Init(config.a9, this.assetService));
      configure.push(a9Configure(config.a9));
      prepareRequestAds.push(a9RemoveKeyValues());
      requestBids.push(a9RequestBids());
    }

    this.adPipeline = new AdPipeline({
      init,
      configure,
      defineSlots: gptDefineSlots(),
      prepareRequestAds,
      requestBids,
      requestAds: gptRequestAds(reportingService)
    }, this.logger, env, this.window, reportingService, this.slotEventService);

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
                this.logger.error('DFP Service', message);
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
   * Reset the gpt targeting configuration (key-values) and uses the targeting information from
   * the given config to set new key values.
   *
   * This method is required for the single-page-application mode to make sure we don't send
   * stale key-values
   *
   * @param config
   */
    // FIXME this must be a init step in the SPA mode!
  public resetTargeting = (config: Moli.MoliConfig): void => {
    this.window.googletag.pubads().clearTargeting();

    // FIXME apply constant targeting again
    // this.configureTargeting(config);
  };


  private getEnvironment(config: Moli.MoliConfig): Moli.Environment {
    return config.environment || 'production';
  }

  private awaitDomReady: InitStep = () => {
    return new Promise<void>(resolve => {
      domready(this.window, resolve);
    }).then(() => this.logger.debug('DOM', 'dom ready'));
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
