import domready from '../util/domready';

import '../types/apstag';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { Moli } from '../types/moli';

import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { ICookieService } from '../util/cookieService';
import { createPerformanceService } from '../util/performanceService';

import { createLazyLoader } from './lazyLoading';
import { createRefreshListener } from './refreshAd';
import { ReportingService } from './reportingService';
import { SizeConfigService } from './sizeConfigService';

import SlotDefinition = Moli.SlotDefinition;
import RefreshableAdSlot = Moli.RefreshableAdSlot;
import DfpSlotSize = Moli.DfpSlotSize;
import { getDefaultLogger, getLogger } from '../util/logging';
import { LabelConfigService } from './labelConfigService';
import { SlotEventService } from './slotEventService';
import { PassbackService } from './passbackService';

type FilterSupportedSizes = (givenSizes: DfpSlotSize[]) => DfpSlotSize[];

export class DfpService {

  /**
   * The DfpService can only be initialized once.
   */
  private initialized: boolean = false;

  /**
   * Access to a logger
   */
  private logger: Moli.MoliLogger;

  /**
   * Track the number of times prebid has been requested.
   * Required for performance marks.
   */
  private prebidRequestCount: number = 0;

  /**
   * Track the number of times a9 bids are fetched.
   * Required for performance marks.
   */
  private a9RequestCount: number = 0;

  /**
   * Report loading metrics
   */
  private reportingService: ReportingService | undefined;
  private slotEventService: SlotEventService | undefined;
  private passbackService: PassbackService | undefined;


  /**
   *
   * @param assetService - Currently needed to load amazon
   * @param cookieService - Access browser cookies
   * @param window
   */
  constructor(private assetService: IAssetLoaderService,
              private cookieService: ICookieService,
              private window: Window) {

    // initialize the logger with a default one
    this.logger = getDefaultLogger();
  }

  /**
   * Initializes the ad setup. This includes
   *
   * - configuring the googletag
   * - configuring prebid
   * - configuring and loading A9
   * - configuring consent management
   *
   * @param config - the ad configuration
   * @return {Promise<void>}   a promise resolving when the first ad is shown OR a timeout occurs
   */
  public initialize = (config: Readonly<Moli.MoliConfig>): Promise<Readonly<Moli.MoliConfig>> => {
    if (this.initialized) {
      const message = 'DFP Service already initialized';
      this.logger.error(message);
      return Promise.reject(message);
    }
    this.initialized = true;

    this.logger = getLogger(config, this.window);

    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };

    // slot and reporting service are not unsable until `initialize()` is called on both services
    const slotEventService = new SlotEventService(this.logger);
    this.slotEventService = slotEventService;
    this.reportingService = new ReportingService(
      createPerformanceService(this.window), slotEventService, reportingConfig, this.logger, this.getEnvironment(config), this.window
    );
    const env = this.getEnvironment(config);

    // a9 script overwrites the window.apstag completely on script load
    if (config.a9 && env === 'production') {
      this.initApstag();
      this.loadA9Script(config); // load a9 script, but we don't have to wait until loaded
    }

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    const prebidReady = config.prebid ?
      this.awaitPrebidLoaded(prebidGlobal).then(() => this.configurePrebid(this.window[prebidGlobal], config)) :
      Promise.resolve();


    const dfpReady =
      this.awaitDomReady()
        .then(() => this.awaitGptLoaded())
        .then(() => this.logger.debug('DFP Service', 'GPT loaded'))
        .then(() => {
          // we pass in the googletag even it may not be available yet. This is not an issue as the first
          // action we take is to wait for the gpt tag to be available.
          this.passbackService = new PassbackService(this.window.googletag, this.logger, this.window);
        })
        .then(() => slotEventService.initialize(this.window.googletag, this.getEnvironment(config)))
        .then(() => this.configureCmp(config, this.reportingService!))
        // initialize the reporting for non-lazy slots
        .then((nonPersonalizeAds) => this.configureAdNetwork(config, nonPersonalizeAds))
        .then(() => this.logger.debug('DFP Service', 'Ad Network configured'))
        .catch(error => {
          this.logger.error('DFP Service', 'failed configuring gpt', error);
          return Promise.reject(error);
        });

    return Promise.all([ prebidReady, dfpReady ]).then(() => config);
  };

  /**
   * Start requesting ads.
   *
   * This method must be called after `initialize(config)`.
   *
   * @example
   * dfpService.initialize(config).then(() => dfpService.requestAds())
   *
   */
  public requestAds = (config: Moli.MoliConfig): Promise<Moli.AdSlot[]> => {
    if (!this.initialized || !this.reportingService || !this.slotEventService || !this.passbackService) {
      const message = 'DFP Service not initialized yet';
      this.logger.error('DFP Service', message);
      return Promise.reject(message);
    }

    const extraLabels = config.targeting && config.targeting.labels ? config.targeting.labels : [];
    const globalLabelConfigService = new LabelConfigService(config.labelSizeConfig || [], extraLabels, this.window);

    const filteredSlots = config.slots
      .filter(slot => globalLabelConfigService.filterSlot(slot));
    this.logger.debug('DFP Service', `filteredSlots: ${filteredSlots.map(slot => `\n\t\t\t[DomID] ${slot.domId} [AdUnitPath] ${slot.adUnitPath}`)}`);

    const instantlyLoadedSlots = this.filterAvailableSlots(filteredSlots).filter(this.isInstantlyLoadedSlot);

    this.reportingService.initialize(instantlyLoadedSlots);

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    // concurrently initialize lazy loaded slots and refreshable slots
    this.initLazyRefreshableSlots(this.window[prebidGlobal], filteredSlots.filter(this.isLazyRefreshableAdSlot), config, this.reportingService, this.slotEventService, globalLabelConfigService, this.passbackService);
    this.initLazyLoadedSlots(this.window[prebidGlobal], filteredSlots.filter(this.isLazySlot), config, this.reportingService, this.slotEventService, globalLabelConfigService, this.passbackService);

    // eagerly displayed slots - this includes 'eager' slots and non-lazy 'refreshable' slots
    return Promise.resolve(instantlyLoadedSlots)
    // configure slots with gpt
      .then((availableSlots: Moli.AdSlot[]) => this.registerSlots(availableSlots, this.getEnvironment(config)))
      .then((registeredSlots: SlotDefinition<Moli.AdSlot>[]) => this.displayAds(registeredSlots))
      .then((registeredSlots) => this.configurePassback(registeredSlots, this.passbackService!))
      .then((registeredSlots) => {
        this.initRefreshableSlots(
          this.window[prebidGlobal],
          registeredSlots.filter(this.isRefreshableAdSlotDefinition),
          config,
          this.reportingService!,
          this.slotEventService!,
          globalLabelConfigService
        );
        return registeredSlots;
      })
      // We wait for a prebid response and then refresh.
      .then(slotDefinitions => this.initHeaderBidding(this.window[prebidGlobal], slotDefinitions, config, this.reportingService!, this.slotEventService!, globalLabelConfigService))
      .then(slotDefinitions => this.refreshAds(slotDefinitions, this.reportingService!, this.getEnvironment(config)))
      .then(slotDefinitions => slotDefinitions.map(slot => slot.moliSlot))
      .catch(reason => {
        this.logger.error('DFP Service', 'Initialization failed: ' + JSON.stringify(reason), reason);
        return Promise.reject(reason);
      });

  };

  public destroyAdSlots = (config: Moli.MoliConfig): Promise<Moli.MoliConfig> => {
    if (!this.initialized) {
      const message = 'Failed to destroy ads. DFP Service not initialized yet.';
      this.logger.error('DFP Service', message);
      return Promise.reject(message);
    }

    return Promise.resolve()
    // remove all event listeners first
      .then(() => this.slotEventService && this.slotEventService.removeAllEventSources(this.window))
      //
      .then(() => this.window.googletag.destroySlots())
      .then(() => {
        const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';
        const pbjs = this.window[prebidGlobal];
        if (pbjs && pbjs.adUnits) {
          this.logger.debug('DFP Service', `Destroying prebid adUnits`, pbjs.adUnits);
          pbjs.adUnits.forEach(adUnit => pbjs.removeAdUnit(adUnit.code));
        }
      })
      .then(() => config);
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
  public resetTargeting = (config: Moli.MoliConfig): void => {
    this.window.googletag.pubads().clearTargeting();
    this.configureTargeting(config);
  };

  /**
   * @param config - the ad configuration
   * @param reportingService - the reporting service that is used to report the cmp loading time
   * @return Promise with nonPersonalizedAds flag - when the promise resolves consent is given or a timeout was hit
   */
  private configureCmp(config: Moli.MoliConfig, reportingService: ReportingService): Promise<0 | 1> {
    const cmp = config.consent.cmp;
    if (!cmp) {
      this.logger.error('DFP Service', 'No CMP module is configured');
      return Promise.reject();
    }

    reportingService.markCmpInitialization();
    this.logger.debug('DFP Service', `Configure cmp using cmp provider: ${cmp.name}`);

    const personalizedAds = cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
      this.logger.debug('DFP Service', 'CMP configured');
      reportingService.measureCmpLoadTime();
      return nonPersonalizedAds;
    });

    // only add a timeout if configured otherwise rely on the behaviour of the provider
    // which is usually blocking!
    if (config.consent.timeout && config.consent.timeout > 0) {
      const noPersonalizedAdsFallback = new Promise<0 | 1>(resolve => {
        setTimeout(() => resolve(1), config.consent.timeout);
      });
      return Promise.race([noPersonalizedAdsFallback, personalizedAds]);
    } else {
      return personalizedAds;
    }

  }

  /**
   * Lazy loaded slots.
   *
   * A lazy loaded slot can contain any other slot. This includes prebid (header bidding) slots.
   * This method handles
   *
   * @param pbjs the prebid instance
   * @param {Promise<Moli.LazyAdSlot[]>} lazyLoadingSlots
   * @param {Moli.MoliConfig} config
   * @param reportingService gather metrics
   * @param slotEventService access to slot events
   * @param globalLabelConfigService filter supported labels
   * @param passbackService
   */
  private initLazyLoadedSlots(
    pbjs: prebidjs.IPrebidJs,
    lazyLoadingSlots: Moli.LazyAdSlot[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService,
    passbackService: PassbackService
  ): void {
    lazyLoadingSlots.forEach((moliSlotLazy) => {
      const filterSupportedSizes = this.getSizeFilterFunction(moliSlotLazy);

      createLazyLoader(moliSlotLazy.behaviour.trigger, slotEventService, this.window).onLoad()
        .then(() => {
          if (this.window.document.getElementById(moliSlotLazy.domId)) {
            return Promise.resolve();
          }
          const message = `lazy slot dom element not available: ${moliSlotLazy.adUnitPath} / ${moliSlotLazy.domId}`;
          this.logger.error('DFP Service', message);
          return Promise.reject(message);
        })
        .then(() => this.registerSlot({ moliSlot: moliSlotLazy, filterSupportedSizes }, this.getEnvironment(config)))
        .then(googleTagAdSlot => {
          const slotDefinition: SlotDefinition<Moli.AdSlot> = {
            adSlot: googleTagAdSlot,
            moliSlot: moliSlotLazy,
            filterSupportedSizes
          };

          // if the ad tag is in a test env don't load any header bidding stuff
          if (this.getEnvironment(config) === 'test') {
            this.logger.warn('DFP Service', 'initLazyLoadedSlots skips prebid requests');
            return Promise.resolve(slotDefinition);
          }

          this.configurePassback([ slotDefinition ], passbackService);

          // check if the lazy slot wraps a prebid slot and request prebid too
          // only executes the necessary parts of `this.initHeaderBidding`

          const bidRequests: Promise<unknown>[] = [];

          if (moliSlotLazy.prebid) {
            bidRequests.push(this.initPrebid(pbjs, [ {
              ...slotDefinition,
              moliSlot: moliSlotLazy as Moli.PrebidAdSlot
            } ], config, reportingService, slotEventService, globalLabelConfigService));
          }

          if (moliSlotLazy.a9) {
            bidRequests.push(this.fetchA9Slots([ {
              ...slotDefinition,
              moliSlot: moliSlotLazy as Moli.A9AdSlot
            } ], reportingService, globalLabelConfigService));
          }

          return Promise.all(bidRequests).then(() => slotDefinition);
        })
        .then(adSlot => {
          this.refreshAds([ adSlot ], reportingService, this.getEnvironment(config));
        })
        .catch(error => {
          this.logger.error('DFP Service', `Failed to initialized lazy loading slot ${moliSlotLazy.adUnitPath} | ${moliSlotLazy.domId}`, error);
        });
    });
  }

  /**
   * Refreshable slots.
   *
   * A refreshable slot can contain any other slot. This includes prebid (header bidding) and lazy loading slots.
   *
   * @param pbjs the global prebid js instance
   * @param registeredSlots already registered ad slots
   * @param {Moli.MoliConfig} config
   * @param reportingService performance metrics and reporting
   * @param slotEventService
   * @param globalLabelConfigService required for labels
   */
  private initRefreshableSlots(
    pbjs: prebidjs.IPrebidJs,
    registeredSlots: SlotDefinition<Moli.RefreshableAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService
  ): void {
    registeredSlots
      .filter(({ moliSlot }) => this.isValidTrigger(moliSlot.behaviour.trigger))
      .forEach((slotDefinition) => {
        try {
          createRefreshListener(slotDefinition.moliSlot.behaviour.trigger, slotDefinition.moliSlot.behaviour.throttle, slotEventService, this.window).addAdRefreshListener(() => {
            this.requestRefreshableSlot(pbjs, slotDefinition, config, reportingService, globalLabelConfigService);
          });
        } catch (e) {
          this.logger.warn('DFP Service', `creating refreshable slots failed for slot ${slotDefinition.moliSlot.adUnitPath}`, e);
        }
      });
  }

  private initLazyRefreshableSlots(
    pbjs: prebidjs.IPrebidJs,
    lazyRefreshableSlots: Moli.RefreshableAdSlot[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService,
    passbackService: PassbackService
  ): void {
    lazyRefreshableSlots
      .filter((moliSlot) => this.isValidTrigger(moliSlot.behaviour.trigger))
      .forEach((moliSlotRefreshable) => {
        const filterSupportedSizes = this.getSizeFilterFunction(moliSlotRefreshable);
        try {

          let adSlot: googletag.IAdSlot;
          createRefreshListener(moliSlotRefreshable.behaviour.trigger, moliSlotRefreshable.behaviour.throttle, slotEventService, this.window).addAdRefreshListener(() => {
            if (!adSlot) {
              this.logger.debug('DFP Service', `Register lazy refreshable slot ${moliSlotRefreshable.domId}`);
              // ad slot has not been registered yet
              adSlot = this.registerSlot({
                moliSlot: moliSlotRefreshable,
                filterSupportedSizes
              }, this.getEnvironment(config));
              if (this.isPrebidSlot(moliSlotRefreshable)) {
                // make sure that the slot is also registered on prebid
                this.registerPrebidSlots(pbjs, [ {
                  moliSlot: moliSlotRefreshable,
                  filterSupportedSizes,
                  adSlot
                } ], config, globalLabelConfigService);
              }
              this.displayAd(moliSlotRefreshable);
            }
            const slotDefinition = { moliSlot: moliSlotRefreshable, adSlot, filterSupportedSizes };

            this.configurePassback([ slotDefinition ], passbackService);
            this.requestRefreshableSlot(pbjs, slotDefinition, config, reportingService, globalLabelConfigService);
          });
        } catch (e) {
          this.logger.warn('DFP Service', `creating lazy refreshable slots failed ${moliSlotRefreshable.adUnitPath}`, e);
        }
      });

  }

  /**
   * Request bids for a refreshable ad slot
   *
   * @param pbjs the prebid instance
   * @param slotDefinition
   * @param config
   * @param reportingService
   * @param globalLabelConfigService
   */
  private requestRefreshableSlot(
    pbjs: prebidjs.IPrebidJs,
    slotDefinition: SlotDefinition<RefreshableAdSlot>,
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalLabelConfigService: LabelConfigService): void {
    const bidRequests: Promise<unknown>[] = [];

    const { moliSlot, adSlot, filterSupportedSizes } = slotDefinition;

    // if the ad tag is in a test env don't load any header bidding stuff
    if (this.getEnvironment(config) === 'test') {
      this.logger.warn('DFP Service', 'requestRefreshableSlot is ignored in test mode');
      return;
    }

    if (this.isPrebidSlot(moliSlot)) {
      const refreshPrebidSlot = this.requestPrebid(pbjs, [ {
        adSlot,
        moliSlot,
        filterSupportedSizes
      } ], config, reportingService, globalLabelConfigService)
        .catch(reason => {
          this.logger.warn('DFP Service', `Failed to request refreshable slot ${moliSlot.adUnitPath} | ${moliSlot.domId}`, reason);
          return {};
        });
      bidRequests.push(refreshPrebidSlot);
    }

    if (this.isA9Slot(moliSlot)) {
      bidRequests.push(this.fetchA9Slots([ {
        ...slotDefinition,
        moliSlot: moliSlot
      } ], reportingService, globalLabelConfigService));
    }

    Promise.all(bidRequests)
      .then(() => {
        this.refreshAds([ slotDefinition ], reportingService, this.getEnvironment(config));
      }).catch((error) => {
      this.logger.error('DFP Service', `refreshable ad slot (${moliSlot.adUnitPath}) initialization failed with ${error}`);
    });
  }

  /**
   * Initialize prebid.js
   *
   * This involves
   * - waiting until available the prebid.js script is available
   * - Registering the prebid slots
   * - Sending the bidRequest via pbjs
   *
   * @param pbjs the prebid instance
   * @param availableSlots all available slots that will eventually be requested
   * @param config the moli config
   * @param reportingService performance metrics and reporting
   * @param slotEventService access to slot events
   * @param globalLabelConfigService required for labels
   * @returns returns the unaltered adSlot definitions
   */
  private initHeaderBidding(
    pbjs: prebidjs.IPrebidJs,
    availableSlots: SlotDefinition<Moli.AdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService
  ): Promise<SlotDefinition<Moli.AdSlot>[]> {
    switch (this.getEnvironment(config)) {
      case 'test':
        this.logger.warn('DFP Service', 'No header bidding in test environment');
        return Promise.resolve(availableSlots);
      case 'production':
        this.logger.debug('DFP Service', 'DFP activate header bidding');

        const prebidSlots: SlotDefinition<Moli.PrebidAdSlot>[] = availableSlots.filter(this.isPrebidSlotDefinition);
        const a9Slots: SlotDefinition<Moli.A9AdSlot>[] = availableSlots.filter(this.isA9SlotDefinition);

        return Promise.all([
          this.initA9(a9Slots, config, reportingService, globalLabelConfigService),
          this.initPrebid(pbjs, prebidSlots, config, reportingService, slotEventService, globalLabelConfigService)
        ]).then(() => availableSlots);
    }


  }

  /**
   * Initialize the given prebid slots. The retuned promise is fulfilled when
   *
   * - prebid.js has been loaded completely
   * - all prebid slots have been registered
   * - all prebid slot have been requested
   *
   * @param pbjs the prebid instance
   * @param prebidSlots all slots - will be filtered for prebid slots
   * @param config full ad configuration
   * @param reportingService performance metrics and reporting
   * @param slotEventService access to slot events
   * @param globalLabelConfigService required for labels and prebid sizes
   * @returns the bid response map. Always empty if not prebid slots are requested
   */
  private initPrebid(
    pbjs: prebidjs.IPrebidJs,
    prebidSlots: SlotDefinition<Moli.PrebidAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService
  ): Promise<prebidjs.IBidResponsesMap> {
    if (prebidSlots.length === 0) {
      return Promise.resolve({});
    }

    if (!config.prebid) {
      this.logger.warn('DFP Service', `Try to init ${prebidSlots.length} prebid slots without a prebid configuration`, prebidSlots);
      return Promise.resolve({});
    }

    if (config.prebid.userSync === 'all-ads-loaded') {
      slotEventService.awaitAllAdSlotsRendered(prebidSlots.map(def => def.moliSlot))
        .then(() => {
          this.logger.debug('trigger prebidjs user sync');
          pbjs.triggerUserSyncs();
        });
    }

    return Promise.resolve()
      .then(() => this.registerPrebidSlots(pbjs, prebidSlots, config, globalLabelConfigService))
      .then(() => this.requestPrebid(pbjs, prebidSlots, config, reportingService, globalLabelConfigService))
      .catch(reason => {
        this.logger.warn('DFP Service', 'init prebid failed', reason);
        return {};
      });
  }

  private configurePrebid(pbjs: prebidjs.IPrebidJs, config: Moli.MoliConfig): Promise<void> {
    return new Promise<Moli.headerbidding.PrebidConfig>((resolve, reject) => {
      if (config.prebid) {
        resolve(config.prebid);
      } else {
        const message = 'Configure prebid without a prebid configuration is not allowed';
        this.logger.error('DFP Service', 'Configure prebid without a prebid configuration is not allowed');
        reject(message);
      }
    }).then(prebidConfig => {
      pbjs.setConfig(prebidConfig.config);
      if (prebidConfig.bidderSettings) {
        pbjs.bidderSettings = prebidConfig.bidderSettings;
      }
    });
  }

  private initA9(a9Slots: SlotDefinition<Moli.A9AdSlot>[], config: Moli.MoliConfig, reportingService: ReportingService, globalLabelConfigService: LabelConfigService): Promise<void> {
    if (a9Slots.length === 0) {
      return Promise.resolve();
    }

    // no a9 configured
    if (!config.a9) {
      this.logger.warn('DFP Service', `Try to init ${a9Slots.length} a9 slots without a a9 configuration`, a9Slots);
      return Promise.resolve();
    }

    return Promise.resolve(a9Slots)
      .then((slots: SlotDefinition<Moli.A9AdSlot>[]) => this.fetchA9Slots(slots, reportingService, globalLabelConfigService))
      .catch(reason => this.logger.warn('DFP Service', 'init A9 failed', reason));
  }

  /**
   * Returns a promise which resolves once the DOM is in the ready state.
   */
  private awaitDomReady(): Promise<void> {
    return new Promise<void>(resolve => {
      domready(this.window, resolve);
    });
  }

  /**
   * Creates a promise which will resolve once the DFP lib is loaded.
   *
   * @return {Promise<void>}
   */
  private awaitGptLoaded(): Promise<void> {
    this.window.googletag = this.window.googletag || { cmd: [] };
    return new Promise<void>(resolve => this.window.googletag.cmd.push(resolve));
  }

  private awaitPrebidLoaded(prebidGlobal: 'pbjs' | 'moliPbjs'): Promise<void> {
    this.window[prebidGlobal] = this.window[prebidGlobal] || { que: [] };

    // if we forget to remove prebid from the configuration. The timeout is arbitrary
    const prebidTimeout = new Promise((_, reject) => {
      setTimeout(
        () => reject('Prebid did not resolve in time. Maybe you forgot to import the prebid distribution in the ad tag'),
        5000
      );
    });

    const prebidLoaded = new Promise<void>(resolve => this.window[prebidGlobal].que.push(resolve));
    Promise.race([ prebidTimeout, prebidLoaded ]).catch(error => {
      this.logger.error('DFP Service', 'Prebid did not resolve. This will stop all ads from being loaded!', error);
    });

    return prebidLoaded;
  }

  private initApstag(): void {
    if (this.window.apstag) {
      return;
    }
    const windowRef = this.window;
    windowRef.apstag = {
      _Q: [],
      init: function (): void {
        windowRef.apstag._Q.push([ 'i', arguments ]);
      },
      fetchBids: function (): void {
        windowRef.apstag._Q.push([ 'f', arguments ]);
      },
      setDisplayBids: function (): void {
        return;
      },
      targetingKeys: function (): void {
        return;
      }
    };
  }

  /**
   * Initialize and load the A9 tag.
   *
   * IMPORTANT NOTE:
   * We can't load the A9 script in our <head> as this breaks the complete ad integration.
   * We weren't able to pin down the reason for this behaviour in a meaningful time, so we
   * stick to the current solution, which is also the suggested integration in the A9 docs.
   *
   *
   * @returns {Promise<void>}
   */
  private loadA9Script(config: Moli.MoliConfig): Promise<void> {
    if (!config.a9) {
      const message = 'a9 initialized without a configuration';
      this.logger.error('DFP Service', message);
      return Promise.reject(message);
    }

    this.window.apstag.init({
      pubID: config.a9.pubID,
      adServer: 'googletag',
      bidTimeout: config.a9.timeout,
      gdpr: {
        cmpTimeout: config.a9.cmpTimeout
      }
    });

    return this.assetService.loadScript({
      name: 'A9',
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: config.a9.scriptUrl ? config.a9.scriptUrl : '//c.amazon-adsystem.com/aax2/apstag.js'
    });
  }


  private configureAdNetwork(config: Moli.MoliConfig, nonPersonalizedAds: 0 | 1): Promise<void> {
    switch (this.getEnvironment(config)) {
      case 'production':
        this.configureTargeting(config);
        this.window.googletag.pubads().enableAsyncRendering();
        this.window.googletag.pubads().disableInitialLoad();
        this.window.googletag.pubads().enableSingleRequest();

        this.logger.debug('DFP Service', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
        if (nonPersonalizedAds) {
          this.logger.debug('DFP Service', 'Serve non-personalized ads');
        }

        this.window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);
        this.window.googletag.enableServices();
        return Promise.resolve();
      case 'test':
        // Note that this call is actually important to initialize the content service. Otherwise
        // the service won't be enabled with the `googletag.enableServices()`.
        this.window.googletag.content().getSlots();
        this.window.googletag.enableServices();
        return Promise.resolve();
    }

  }

  private configureTargeting(config: Moli.MoliConfig): void {
    switch (this.getEnvironment(config)) {
      case 'production':
        const keyValueMap = config.targeting ? config.targeting.keyValues : {};
        Object.keys(keyValueMap).forEach(key => {
          const value = keyValueMap[key];
          if (value) {
            this.window.googletag.pubads().setTargeting(key, value);
          }
        });
        return;
      case 'test':
        return;
    }
  }

  private filterAvailableSlots(slots: Moli.AdSlot[]): Moli.AdSlot[] {
    return slots.filter((slot: Moli.AdSlot) => !!this.window.document.getElementById(slot.domId));
  }

  /**
   * Register prebid slots with pbjs.
   *
   * @param pbjs the prebid instance
   * @param dfpPrebidSlots that should be registered
   * @param config the moli global config
   * @param globalLabelConfigService - filter prebid ad unit objects (bids) by label
   * @returns the unaltered prebid slots
   */
  private registerPrebidSlots(pbjs: prebidjs.IPrebidJs, dfpPrebidSlots: SlotDefinition<Moli.PrebidAdSlot>[],
                              config: Moli.MoliConfig,
                              globalLabelConfigService: LabelConfigService
  ): void {
    const prebidAdUnits = dfpPrebidSlots.map(({ moliSlot, filterSupportedSizes }) => {
      this.logger.debug('DFP Service', `Prebid add ad unit: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);

      const keyValues = config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {};
      const prebidAdSlotConfig = (typeof moliSlot.prebid === 'function') ? moliSlot.prebid({ keyValues: keyValues }) : moliSlot.prebid;
      const mediaTypeBanner = prebidAdSlotConfig.adUnit.mediaTypes.banner;
      const mediaTypeVideo = prebidAdSlotConfig.adUnit.mediaTypes.video;

      const bannerSizes = mediaTypeBanner ? filterSupportedSizes(mediaTypeBanner.sizes).filter(this.isFixedSize) : [];
      const videoSizes = mediaTypeVideo ? this.filterVideoPlayerSizes(mediaTypeVideo.playerSize, filterSupportedSizes) : [];

      // filter bids ourselves and don't rely on prebid to have a stable API
      const bids = prebidAdSlotConfig.adUnit.bids.filter(bid => globalLabelConfigService.filterSlot(bid));

      const video = (mediaTypeVideo && videoSizes.length > 0) ? {
        video: { ...mediaTypeVideo, playerSize: videoSizes }
      } : undefined;

      const banner = (mediaTypeBanner && bannerSizes.length > 0) ? {
        banner: { ...mediaTypeBanner, sizes: bannerSizes }
      } : undefined;

      return {
        code: moliSlot.domId,
        mediaTypes: {
          ...video,
          ...banner,
        },
        bids: bids
      } as prebidjs.IAdUnit;
    }).filter(adUnit => {
      return adUnit.bids.length > 0 && adUnit.mediaTypes && (adUnit.mediaTypes.banner || adUnit.mediaTypes.video);
    });

    pbjs.addAdUnits(prebidAdUnits);
  }

  private fetchA9Slots(slots: Moli.SlotDefinition<Moli.A9AdSlot>[],
                       reportingService: ReportingService,
                       globalLabelConfigService: LabelConfigService
  ): Promise<void> {
    const filteredSlots = slots.filter(slot => {
      const filterSlot = globalLabelConfigService.filterSlot(slot.moliSlot.a9);
      const sizesNotEmpty = slot.filterSupportedSizes(slot.moliSlot.sizes).filter(this.isFixedSize).length > 0;
      return filterSlot && sizesNotEmpty;
    });

    this.logger.debug('DFP Service', `Fetch A9 Slots: ${filteredSlots.map(slot => `[DomID] ${slot.moliSlot.domId} [AdUnitPath] ${slot.moliSlot.adUnitPath}`)}`);

    if (filteredSlots.length === 0) {
      return Promise.resolve();
    }

    // increase the a9 request count
    this.a9RequestCount = this.a9RequestCount + 1;
    const currentRequestCount = this.a9RequestCount;

    return new Promise<void>(resolve => {
      reportingService.markA9fetchBids(currentRequestCount);
      this.window.apstag.fetchBids({
        slots: filteredSlots.map(({ moliSlot, filterSupportedSizes }) => {
          return {
            slotID: moliSlot.domId,
            slotName: moliSlot.adUnitPath,
            sizes: filterSupportedSizes(moliSlot.sizes).filter(this.isFixedSize)
          };
        })
      }, (_bids: Object[]) => {
        reportingService.measureAndReportA9BidsBack(currentRequestCount);
        this.window.apstag.setDisplayBids();
        resolve();
      });
    });

  }

  /**
   * Calls all configured SSPs to send bids for the registered prebid slots.
   *
   * @returns {Promise<void>} resolves when the bidsBackHandler is executed
   */
  private requestPrebid(
    pbjs: prebidjs.IPrebidJs,
    slotDefinitions: SlotDefinition<Moli.PrebidAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalLabelConfigService: LabelConfigService
  ): Promise<prebidjs.IBidResponsesMap> {
    return new Promise<prebidjs.IBidResponsesMap>(resolve => {

      // increase the prebid request count
      this.prebidRequestCount = this.prebidRequestCount + 1;
      const currentRequestCount = this.prebidRequestCount;

      // It seems that the bidBackHandler can be triggered more than once. The reason might be that
      // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
      // afterwards anyway the bidsBackHandler is called a second time.
      let adserverRequestSent = false;

      const dfpSlots = slotDefinitions.map(slot => slot.moliSlot);
      const adUnitCodes = dfpSlots.map(slot => slot.domId);

      this.logger.debug('DFP Service', `Prebid request bids: \n\t\t\t${adUnitCodes.join('\n\t\t\t')}`);

      reportingService.markPrebidSlotsRequested(currentRequestCount);
      pbjs.requestBids({
        adUnitCodes: adUnitCodes,
        labels: globalLabelConfigService.getSupportedLabels(),
        bidsBackHandler: (bidResponses?: prebidjs.IBidResponsesMap, timedOut?: boolean) => {
          // the bids back handler seems to run on a different thread
          // in consequence, we need to catch errors here to propagate them to top levels
          try {
            if (adserverRequestSent) {
              return;
            }

            if (!bidResponses) {
              this.logger.warn('DFP Service', `Undefined bid response map for ad unit codes: ${adUnitCodes.join(', ')}`);
              return resolve({});
            }

            adserverRequestSent = true;
            reportingService.measureAndReportPrebidBidsBack(currentRequestCount);

            // execute listener
            if (config.prebid && config.prebid.listener) {
              const keyValues = config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {};
              const prebidListener = (typeof config.prebid.listener === 'function') ? config.prebid.listener({ keyValues: keyValues }) : config.prebid.listener;
              if (prebidListener.preSetTargetingForGPTAsync) {
                try {
                  prebidListener.preSetTargetingForGPTAsync(bidResponses, timedOut || false, slotDefinitions);
                } catch (e) {
                  this.logger.error('DFP Service', `Failed to execute prebid preSetTargetingForGPTAsync listener. ${e}`);
                }
              }
            }

            // set key-values for DFP to target the correct line items
            pbjs.setTargetingForGPTAsync(adUnitCodes);

            adUnitCodes.forEach(adUnitPath => {
              const bidResponse = bidResponses[adUnitPath];
              bidResponse ?
                this.logger.debug('DFP Service', `Prebid bid response: [DomID]: ${adUnitPath} \n\t\t\t${bidResponse.bids.map(bid => `[bidder] ${bid.bidder} [width] ${bid.width} [height] ${bid.height} [cpm] ${bid.cpm}`)}`) :
                this.logger.debug('DFP Service', `Prebid bid response: [DomID] ${adUnitPath} ---> no bid response`);
            });

            resolve(bidResponses);
          } catch (error) {
            this.logger.error('DFP Service', 'DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error));
            resolve({});
          }
        }
      });
    });

  }

  private registerSlots(slots: Moli.AdSlot[], env: Moli.Environment): SlotDefinition<Moli.AdSlot>[] {
    if (slots.length === 0) {
      this.logger.debug('DFP Service', 'No DFP ads displayed!');
    }

    return slots.map((moliSlot: Moli.AdSlot) => {
      const filterSupportedSizes = this.getSizeFilterFunction(moliSlot);
      const googleTagAdSlot = this.registerSlot({ moliSlot, filterSupportedSizes }, env);

      return { moliSlot: moliSlot, adSlot: googleTagAdSlot, filterSupportedSizes };
    });
  }

  private registerSlot(slotDefinition: Pick<SlotDefinition<Moli.AdSlot>, 'moliSlot' | 'filterSupportedSizes'>, env: Moli.Environment): googletag.IAdSlot {
    const { moliSlot, filterSupportedSizes } = slotDefinition;
    const sizes = filterSupportedSizes(moliSlot.sizes);

    const adSlot: googletag.IAdSlot | null = moliSlot.position === 'in-page' ?
      this.window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
      this.window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId);

    if (adSlot) {
      adSlot.setCollapseEmptyDiv(true);
      switch (env) {
        case 'production':
          adSlot.addService(this.window.googletag.pubads());
          break;
        case 'test':
          this.logger.warn('DFP Service', `Enabling content service on ${adSlot.getSlotElementId()}`);
          adSlot.addService(this.window.googletag.content());
      }


      this.logger.debug('DFP Service', `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
      return adSlot;
    } else {
      const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
      this.logger.error('DFP Service', error);
      throw new Error(error);
    }
  }

  private configurePassback(slots: SlotDefinition<Moli.AdSlot>[], passbackService: PassbackService): SlotDefinition<Moli.AdSlot>[] {
    slots.filter(slot => slot.moliSlot.passbackSupport).forEach(slot => {
      passbackService.addAdSlot(slot);
    });
    return slots;
  }

  private displayAds(slots: SlotDefinition<Moli.AdSlot>[]): SlotDefinition<Moli.AdSlot>[] {
    slots.forEach((definition: SlotDefinition<Moli.AdSlot>) => this.displayAd(definition.moliSlot));
    return slots;
  }

  private displayAd(dfpSlot: Moli.AdSlot): void {
    this.logger.debug('DFP Service', `Display slot: [DomID] ${dfpSlot.domId} [AdUnitPath] ${dfpSlot.adUnitPath}`);
    this.window.googletag.display(dfpSlot.domId);
  }

  /**
   * Refresh all the passed slots
   * @param slots - the slots that should be refreshed
   * @param reportingService - used to mark the refresh call of a service
   * @param env - the ad tag environment
   * @returns {SlotDefinition[]} unaltered
   */
  private refreshAds(slots: SlotDefinition<Moli.AdSlot>[], reportingService: ReportingService, env: Moli.Environment): SlotDefinition<Moli.AdSlot>[] {
    switch (env) {
      case 'test':
        slots.forEach(({ adSlot, moliSlot, filterSupportedSizes }) => {
          const containerId = `${moliSlot.domId}__container`;
          const containerWidthId = `${moliSlot.domId}__container_width`;
          const containerHeightId = `${moliSlot.domId}__container_height`;

          // pick a random, fixed sizes
          const sizes = filterSupportedSizes(moliSlot.sizes)
          // no fluid sizes
            .filter(this.isFixedSize)
            // no 1x1 sizes
            .filter(([ width, height ]) => width > 1 && height > 1);
          const rnd = Math.floor(Math.random() * 20) + 1;
          const index = (sizes.length - 1) % rnd;
          const [ width, height ] = sizes.length === 0 ? [ 300, 250 ] : sizes[index];

          const buttons = sizes.map(([ width, height ]) => {
            const resize = `(function(){
              var container = document.getElementById('${containerId}');
              container.style.width = '${width}px';
              container.style.height = '${height}px';
              document.getElementById('${containerWidthId}').textContent = ${width};;
              document.getElementById('${containerHeightId}').textContent = ${height};;
            })()`;
            return `<button onclick="${resize}" style="font-size: 10px; background: #00a4a6; color: white; border: 1px dotted white;">${width}x${height}</button>`;
          }).join('\n');

          // CSS Pattern from https://leaverou.github.io/css3patterns/#lined-paper
          const html = `<div id="${containerId}"
                             style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
                             width: ${width}px; height: ${height}px; padding: 6px; border: 2px dotted gray;
                             background-color: #fff;
                             background-image:
                             linear-gradient(90deg, transparent 79px, #abced4 79px, #abced4 81px, transparent 81px),
                             linear-gradient(#eee .1em, transparent .1em);
                             background-size: 100% 1.2em;
                             ">
<div style="position: absolute; top: 5px; left: 5px">${buttons}</div>        
<div><h4><strong id="${containerWidthId}">${width}</strong>x<strong id="${containerHeightId}">${height}</strong> pixel</h4></div>
</div>`;

          this.window.googletag.content().setContent(adSlot, html);
        });
        break;
      case 'production':
        // clear targetings for each slot before refreshing
        this.window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
        break;
    }

    slots.forEach(slot => {
      this.logger.debug('DFP Service', `Refresh slot: [DomID] ${slot.moliSlot.domId} [AdUnitPath] ${slot.moliSlot.adUnitPath}`);
      reportingService.markRefreshed(slot.moliSlot);
    });
    return slots;
  }


  /**
   * Checks if the slot has a 'lazy' behaviour
   * - true if this is a lazy ad slot
   * - true if this is a refreshable ad slot with lazy=true
   *
   * @param slot the slot that should be checked
   * @returns true if the slot is immediately requested
   */
  private isInstantlyLoadedSlot(slot: Moli.AdSlot): boolean {
    return !(
      slot.behaviour.loaded === 'lazy' ||
      (slot.behaviour.loaded === 'refreshable' && ((slot as Moli.RefreshableAdSlot).behaviour.lazy || false))
    );
  }

  private isValidTrigger(trigger: Moli.behaviour.Trigger): boolean {
    return !(typeof trigger.source === 'string') || !!this.window.document.querySelector(trigger.source);
  }

  /**
   * Decides which sizeConfigService to use - if the slot brings its own sizeConfig, it gets precedence over the
   * global one.
   *
   * @param moliSlot the ad slot
   * @param globalSizeConfigService the global sizeConfigService
   */
  private getSizeFilterFunction(moliSlot: Moli.AdSlot): FilterSupportedSizes {
    return (givenSizes: DfpSlotSize[]) => new SizeConfigService(moliSlot.sizeConfig, this.window).filterSupportedSizes(givenSizes);
  }

  private isLazySlot(slot: Moli.AdSlot): slot is Moli.LazyAdSlot {
    return slot.behaviour.loaded === 'lazy';
  }

  private isLazyRefreshableAdSlot(slot: Moli.AdSlot): slot is Moli.RefreshableAdSlot {
    return slot.behaviour.loaded === 'refreshable' && ((slot as Moli.RefreshableAdSlot).behaviour.lazy || false);
  }

  private isRefreshableAdSlotDefinition(slotDefinition: SlotDefinition<Moli.AdSlot>): slotDefinition is SlotDefinition<Moli.RefreshableAdSlot> {
    return slotDefinition.moliSlot.behaviour.loaded === 'refreshable';
  }

  private isPrebidSlotDefinition(slotDefinition: SlotDefinition<Moli.AdSlot>): slotDefinition is SlotDefinition<Moli.PrebidAdSlot> {
    return !!slotDefinition.moliSlot.prebid;
  }

  private isPrebidSlot(slot: Moli.AdSlot): slot is Moli.PrebidAdSlot {
    return !!slot.prebid;
  }

  private isA9SlotDefinition(slotDefinition: SlotDefinition<Moli.AdSlot>): slotDefinition is SlotDefinition<Moli.A9AdSlot> {
    return !!slotDefinition.moliSlot.a9;
  }

  private isA9Slot(slot: Moli.AdSlot): slot is Moli.A9AdSlot {
    return !!slot.a9;
  }

  private isFixedSize(size: Moli.DfpSlotSize): size is [ number, number ] {
    return size !== 'fluid';
  }

  private isSinglePlayerSize(size: prebidjs.IMediaTypeVideo['playerSize']): size is [ number, number ] {
    return size.length === 2 && typeof size[0] === 'number' && typeof size[1] === 'number';
  }

  /**
   * Filters video player sizes according to the sizeConfig;
   *
   *  * if no sizes are configured the `playerSize` is empty
   *  * if it is a single tuple ([number, number]), then this single tuple is checked and returned, if it fits.
   *  * if it's an array of sizes, the array is checked and the fitting entries are returned.
   *  * if all sizes are filtered out the `playerSize` is empty
   *
   * @param playerSize the (array of) player size(s)
   * @param filterSupportedSizes function provided by the global or slot-local sizeConfig to filter the slot's sizes
   */
  private filterVideoPlayerSizes(playerSize: prebidjs.IMediaTypeVideo['playerSize'], filterSupportedSizes: FilterSupportedSizes): [ number, number ][] {

    const supportedSizes = filterSupportedSizes(
      this.isSinglePlayerSize(playerSize) ? [ playerSize ] : playerSize
    ).filter(this.isFixedSize);

    if (playerSize.length === 0 || supportedSizes.length === 0) {
      return [];
    } else if (supportedSizes.length > 1) {
      this.logger.warn('DFP Service', `multiple sizes were detected for video player size: ${supportedSizes.map(size => `[${size}]`)}`);
    }

    return supportedSizes;
  }

  private getEnvironment(config: Moli.MoliConfig): Moli.Environment {
    return config.environment || 'production';
  }

}
