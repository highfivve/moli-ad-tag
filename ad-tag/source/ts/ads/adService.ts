import { IAssetLoaderService } from '../util/assetLoaderService';
import { getDefaultLogger, getLogger } from '../util/logging';
import { Moli } from '../types/moli';
import { AdPipeline, ConfigureStep, InitStep, PrepareRequestAdsStep } from './adPipeline';
import { SlotEventService } from './slotEventService';
import { ReportingService } from './reportingService';
import { createPerformanceService } from '../util/performanceService';
import { YieldOptimizationService } from './yieldOptimizationService';
import { gptConfigure, gptDefineSlots, gptInit, gptRequestAds } from './googleAdManager';
import domready from '../util/domready';
import { prebidConfigure, prebidInit, prebidPrepareRequestAds } from './prebid';
import { a9Configure, a9Init, a9PrepareRequestAds } from './a9';
import { isNotNull } from '../util/arrayUtils';
import { createLazyLoader } from './lazyLoading';
import { createRefreshListener } from './refreshAd';
import { consentConfigureGpt } from "./consent";


export class AdService {

  /**
   * Access to a logger
   */
  private logger: Moli.MoliLogger;

  /**
   * Slot event mangement
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
    requestAds: () => Promise.resolve()

  }, this.logger);

  constructor(private assetService: IAssetLoaderService,
              private window: Window) {    // initialize the logger with a default one
    this.logger = getDefaultLogger();
  }

  public initialize = (config: Readonly<Moli.MoliConfig>): Promise<Readonly<Moli.MoliConfig>> => {
    const env = this.getEnvironment(config);
    // 1. setup all services
    this.logger = getLogger(config, this.window);

    // slot and reporting service are not usable until `initialize()` is called on both services


    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };
    const reportingService = new ReportingService(
      createPerformanceService(this.window), this.slotEventService, reportingConfig, this.logger, this.getEnvironment(config), this.window
    );

    // TODO yield optimization - should this be a module?
    // TODO this may not be a service, but a prepareRequestAds step
    const yieldOptimizationService = new YieldOptimizationService(
      config.yieldOptimization, this.assetService, this.logger
    );

    // TODO passbackService may not be a service, but a prepareRequestAds step
    // TODO passbackService could be a module as well


    // 2. build the AdPipeline
    const init: InitStep[] = [
      this.awaitDomReady,
      gptInit(this.window)
    ];
    const configure: ConfigureStep[] = [
      gptConfigure(this.window, config, this.logger)
    ];

    if (config.consent.cmp) {
      configure.push(consentConfigureGpt(this.window, config.consent.cmp, this.logger));
    }

    const prepareRequestAds: PrepareRequestAdsStep[] = [];

    // prebid
    if (config.prebid) {
      init.push(prebidInit(this.window));
      configure.push(prebidConfigure(this.window, config.prebid));
      prepareRequestAds.push(prebidPrepareRequestAds(this.window, config.prebid));
    }

    // amazon a9
    if (config.a9) {
      init.push(a9Init(this.window, config.a9, this.assetService));
      configure.push(a9Configure(this.window, config.a9));
      prepareRequestAds.push(a9PrepareRequestAds(this.window, config.a9));
    }


    this.adPipeline = new AdPipeline({
      init,
      configure,
      defineSlots: gptDefineSlots(this.window, env, this.logger),
      prepareRequestAds,
      requestAds: gptRequestAds(this.window)
    }, this.logger);

    return Promise.resolve(config);
  };


  public requestAds = (config: Readonly<Moli.MoliConfig>): Promise<Moli.AdSlot[]> => {

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
            .then(() => this.adPipeline.run([ slot ]));

          return null;
        } else if (this.isRefreshableAdSlot(slot)) {
          // initialize lazy refreshable slot
          createRefreshListener(slot.behaviour.trigger, slot.behaviour.throttle, this.slotEventService, this.window)
            .addAdRefreshListener(() => this.adPipeline.run([ slot ]));

          // if the slot should be lazy loaded don't return it
          return slot.behaviour.lazy ? null : slot;
        } else {
          return slot;
        }
      })
      .filter(isNotNull)
      .filter(this.isSlotAvailable);


    return this.adPipeline.run(immediatelyLoadedSlots).then(() => immediatelyLoadedSlots);
  };


  private getEnvironment(config: Moli.MoliConfig): Moli.Environment {
    return config.environment || 'production';
  }

  private awaitDomReady: InitStep = () => {
    return new Promise<void>(resolve => {
      domready(this.window, resolve);
    }).then(() => this.logger.debug('dom ready'));
  };

  private isLazySlot(slot: Moli.AdSlot): slot is Moli.LazyAdSlot {
    return slot.behaviour.loaded === 'lazy';
  }

  private isRefreshableAdSlot(slot: Moli.AdSlot): slot is Moli.RefreshableAdSlot {
    return slot.behaviour.loaded === 'refreshable';
  }

  private isSlotAvailable(slot: Moli.AdSlot): boolean {
    return !!this.window.document.getElementById(slot.domId);
  }

}
