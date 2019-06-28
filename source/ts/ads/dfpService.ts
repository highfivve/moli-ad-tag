import domready = require('domready');

import '../types/apstag';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { Moli } from '../types/moli';

import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { ICookieService } from '../util/cookieService';
import { performanceMeasurementService } from '../util/performanceService';

import { createLazyLoader } from './lazyLoading';
import { getPersonalizedAdSetting } from './personalizedAdsProvider';
import { createRefreshListener } from './refreshAd';
import { ReportingService } from './reportingService';
import { SizeConfigService } from './sizeConfigService';

import SlotDefinition = Moli.SlotDefinition;
import RefreshableAdSlot = Moli.RefreshableAdSlot;
import DfpSlotSize = Moli.DfpSlotSize;
import { FaktorCmp } from './cmp/faktor';
import { getDefaultLogger, getLogger } from '../util/logging';
import { LabelConfigService } from './labelConfigService';
import { SlotEventService } from './slotEventService';

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


  /**
   *
   * @param assetService - Currently needed to load amazon
   * @param cookieService - Access browser cookies
   */
  constructor(private assetService: IAssetLoaderService,
              private cookieService: ICookieService) {

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
  public initialize = (config: Moli.MoliConfig): Promise<Moli.MoliConfig> => {
    if (this.initialized) {
      const message = 'DFP Service already initialized';
      this.logger.error(message);
      return Promise.reject(message);
    }
    this.initialized = true;

    this.logger = getLogger(config);

    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };

    // slot and reporting service are not unsable until `initialize()` is called on both services
    const slotEventService = new SlotEventService();
    this.slotEventService = slotEventService;
    this.reportingService = new ReportingService(
      performanceMeasurementService, slotEventService, reportingConfig, this.logger, this.getEnvironment(config)
    );

    const env = this.getEnvironment(config);

    // a9 script overwrites the window.apstag completely on script load
    if (config.a9 && env === 'production') {
      this.initApstag();
      this.loadA9Script(config); // load a9 script, but we don't have to wait until loaded
    }

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    const prebidReady = config.prebid ?
      this.awaitPrebidLoaded(prebidGlobal).then(() => this.configurePrebid(window[prebidGlobal], config)) :
      Promise.resolve();


    const dfpReady =
      this.awaitDomReady()
        .then(() => this.awaitGptLoaded())
        .then(() => this.logger.debug('DFP Service', 'GPT loaded'))
        .then(() => slotEventService.initialize(window.googletag, this.getEnvironment(config)))
        .then(() => this.configureCmp(config, this.reportingService!))
        .then(() => this.logger.debug('DFP Service', 'CMP configured'))
        // initialize the reporting for non-lazy slots
        .then(() => this.configureAdNetwork(config))
        .then(() => this.logger.debug('DFP Service', 'Ad Network configured'))
        .catch(error => {
          this.logger.error('DFP Service', 'failed configuring gpt', error);
          return Promise.reject(error);
        });

    if (config.sovrnAssetUrl && env === 'production') {
      this.loadSovrnScript(config.sovrnAssetUrl);
    }

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
    if (!this.initialized || !this.reportingService || !this.slotEventService) {
      const message = 'DFP Service not initialized yet';
      this.logger.error('DFP Service', message);
      return Promise.reject(message);
    }

    const extraLabels = config.targeting && config.targeting.labels ? config.targeting.labels : [];
    const globalLabelConfigService = new LabelConfigService(config.labelSizeConfig || [], extraLabels);

    const filteredSlots = config.slots
      .filter(slot => globalLabelConfigService.filterSlot(slot));
    this.logger.debug('DFP Service', `filteredSlots: ${filteredSlots.map(slot => `\n\t\t\t[DomID] ${slot.domId} [AdUnitPath] ${slot.adUnitPath}`)}`);

    const instantlyLoadedSlots = this.filterAvailableSlots(filteredSlots).filter(this.isInstantlyLoadedSlot);

    this.reportingService.initialize(instantlyLoadedSlots);

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    // concurrently initialize lazy loaded slots and refreshable slots
    this.initLazyRefreshableSlots(window[prebidGlobal], filteredSlots.filter(this.isLazyRefreshableAdSlot), config, this.reportingService, globalLabelConfigService);
    this.initLazyLoadedSlots(window[prebidGlobal], filteredSlots.filter(this.isLazySlot), config, this.reportingService, this.slotEventService, globalLabelConfigService);

    // eagerly displayed slots - this includes 'eager' slots and non-lazy 'refreshable' slots
    return Promise.resolve()
    // request all existing and non-lazy loading slots
      .then(() => this.filterAvailableSlots(filteredSlots).filter(this.isInstantlyLoadedSlot))
      // configure slots with gpt
      .then((availableSlots: Moli.AdSlot[]) => this.registerSlots(availableSlots, this.getEnvironment(config)))
      .then((registeredSlots: SlotDefinition<Moli.AdSlot>[]) => this.displayAds(registeredSlots))
      .then((registeredSlots) => {
        this.initRefreshableSlots(window[prebidGlobal], registeredSlots.filter(this.isRefreshableAdSlotDefinition), config, this.reportingService!, globalLabelConfigService);
        return registeredSlots;
      })
      // We wait for a prebid response and then refresh.
      .then(slotDefinitions => this.initHeaderBidding(window[prebidGlobal], slotDefinitions, config, this.reportingService!, this.slotEventService!, globalLabelConfigService))
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
      .then(() => window.googletag.destroySlots())
      .then(() => {
        const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';
        const pbjs = window[prebidGlobal];
        this.logger.debug('DFP Service', `Destroying prebid adUnits`, pbjs.adUnits);
        pbjs.adUnits.forEach(adUnit => pbjs.removeAdUnit(adUnit.code));
      })
      .then(() => config);
  };

  /**
   * @param config - the ad configuration
   * @param reportingService - the reporting service that is used to report the cmp loading time
   */
  private configureCmp(config: Moli.MoliConfig, reportingService: ReportingService): Promise<void> {
    const cmpConfig = config.consent.cmpConfig;

    this.logger.debug('DFP Service', `Configure cmp using cmp provider: ${cmpConfig.provider}`);

    if (cmpConfig) {
      switch (cmpConfig.provider) {
        case 'publisher' : {
          return Promise.resolve();
        }
        case 'faktor' : {
          const faktorCmp = new FaktorCmp(reportingService, this.logger);
          if (cmpConfig.autoOptIn) {
            return faktorCmp.autoOptIn();
          } else {
            return Promise.resolve();
          }
        }
        default: {
          return Promise.resolve();
        }
      }
    } else {
      return Promise.resolve();
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
   */
  private initLazyLoadedSlots(
    pbjs: prebidjs.IPrebidJs,
    lazyLoadingSlots: Moli.LazyAdSlot[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    slotEventService: SlotEventService,
    globalLabelConfigService: LabelConfigService
  ): void {
    lazyLoadingSlots.forEach((moliSlotLazy) => {
      const filterSupportedSizes = this.getSizeFilterFunction(moliSlotLazy);

      createLazyLoader(moliSlotLazy.trigger).onLoad()
        .then(() => {
          if (document.getElementById(moliSlotLazy.domId)) {
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
   * @param globalLabelConfigService required for labels
   */
  private initRefreshableSlots(
    pbjs: prebidjs.IPrebidJs,
    registeredSlots: SlotDefinition<Moli.RefreshableAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalLabelConfigService: LabelConfigService
  ): void {
    registeredSlots
      .filter(({ moliSlot }) => this.isValidTrigger(moliSlot.trigger))
      .forEach((slotDefinition) => {
        try {
          createRefreshListener(slotDefinition.moliSlot.trigger).addAdRefreshListener(() => {
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
    globalLabelConfigService: LabelConfigService
  ): void {
    lazyRefreshableSlots
      .filter((moliSlot) => this.isValidTrigger(moliSlot.trigger))
      .forEach((moliSlotRefreshable) => {
        const filterSupportedSizes = this.getSizeFilterFunction(moliSlotRefreshable);
        try {

          let adSlot: googletag.IAdSlot;
          createRefreshListener(moliSlotRefreshable.trigger).addAdRefreshListener(() => {
            if (!adSlot) {
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
            this.requestRefreshableSlot(
              pbjs,
              { moliSlot: moliSlotRefreshable, adSlot, filterSupportedSizes },
              config,
              reportingService,
              globalLabelConfigService
            );
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
      domready(resolve);
    });
  }

  /**
   * Creates a promise which will resolve once the DFP lib is loaded.
   *
   * @return {Promise<void>}
   */
  private awaitGptLoaded(): Promise<void> {
    window.googletag = window.googletag || { cmd: [] };
    return new Promise<void>(resolve => window.googletag.cmd.push(resolve));
  }

  private awaitPrebidLoaded(prebidGlobal: 'pbjs' | 'moliPbjs'): Promise<void> {
    window[prebidGlobal] = window[prebidGlobal] || { que: [] };
    return new Promise(resolve => window[prebidGlobal].que.push(resolve));
  }

  private initApstag(): void {
    if (window.apstag) {
      return;
    }
    window.apstag = {
      _Q: [],
      init: function (): void {
        window.apstag._Q.push([ 'i', arguments ]);
      },
      fetchBids: function (): void {
        window.apstag._Q.push([ 'f', arguments ]);
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

    window.apstag.init({
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

  /**
   * We use sovrn to reload ads every 20 seconds,
   * if the user is active on the page and the ad is in the user's viewport
   *
   * Sovrn has API-access (readonly) to our admanager, so that they can exclude ads
   * based on order id, line item type or placement id from reloading.
   *
   * In the second dfp request ads call, sovrn is sending a key-value `sovrn-reload = true`,
   * so that we can also exclude ads from being requested in the second round
   * or to make reports in dfp.
   *
   * @see We can configure the sovrn script here @link {https://meridian.sovrn.com/#adtags/connect_tags}
   * @see The sovrn documentation is here @link {https://www.sovrn.com/support/frequently-asked-questions-for-signal/}
   */
  private loadSovrnScript(assetUrl: string): Promise<void> {
    this.logger.debug('DFP Service', 'loading sovrn script to enable ad reload');

    return this.assetService.loadScript({
      name: 'Sovrn Ad Reload',
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: assetUrl
    });
  }

  private configureAdNetwork(config: Moli.MoliConfig): Promise<void> {
    switch (this.getEnvironment(config)) {
      case 'production':
        const keyValueMap = config.targeting ? config.targeting.keyValues : {};
        Object.keys(keyValueMap).forEach(key => {
          const value = keyValueMap[key];
          if (value) {
            window.googletag.pubads().setTargeting(key, value);
          }
        });
        window.googletag.pubads().enableAsyncRendering();
        window.googletag.pubads().disableInitialLoad();
        window.googletag.pubads().enableSingleRequest();
        return getPersonalizedAdSetting(config.consent).then(nonPersonalizedAds => {
          this.logger.debug('DFP Service', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
          if (nonPersonalizedAds) {
            this.logger.debug('DFP Service', 'Serve non-personalized ads');
          }
          window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);
          window.googletag.enableServices();
        });
      case 'test':
        // Note that this call is actually important to initialize the content service. Otherwise
        // the service won't be enabled with the `googletag.enableServices()`.
        window.googletag.content().getSlots();
        window.googletag.enableServices();
        return Promise.resolve();
    }

  }

  private filterAvailableSlots(slots: Moli.AdSlot[]): Moli.AdSlot[] {
    return slots.filter((slot: Moli.AdSlot) => !!document.getElementById(slot.domId));
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
    pbjs.addAdUnits(dfpPrebidSlots.map(({ moliSlot, filterSupportedSizes }) => {
      this.logger.debug('DFP Service', `Prebid add ad unit: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);

      const keyValues = config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {};
      const prebidAdSlotConfig = (typeof moliSlot.prebid === 'function') ? moliSlot.prebid({ keyValues: keyValues }) : moliSlot.prebid;
      const mediaTypeBanner = prebidAdSlotConfig.adUnit.mediaTypes.banner;
      const mediaTypeVideo = prebidAdSlotConfig.adUnit.mediaTypes.video;

      const bannerSizes = mediaTypeBanner ? filterSupportedSizes(mediaTypeBanner.sizes).filter(this.isFixedSize) : [];
      const videoSizes = mediaTypeVideo ? this.filterVideoPlayerSizes(mediaTypeVideo.playerSize, filterSupportedSizes) : [];

      // filter bids ourselves and don't rely on prebid to have a stable API
      const bids = prebidAdSlotConfig.adUnit.bids.filter(bid => globalLabelConfigService.filterSlot(bid));

      return {
        code: moliSlot.domId,
        mediaTypes: {
          ...prebidAdSlotConfig.adUnit.mediaTypes,
          video: (mediaTypeVideo && videoSizes.length > 0) ? {
            ...mediaTypeVideo,
            playerSize: videoSizes
          } : undefined,
          banner: (mediaTypeBanner && bannerSizes.length > 0) ? {
            ...mediaTypeBanner,
            sizes: bannerSizes
          } : undefined
        },
        bids: bids
      };
    }));
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
      window.apstag.fetchBids({
        slots: filteredSlots.map(({ moliSlot, filterSupportedSizes }) => {
          return {
            slotID: moliSlot.domId,
            slotName: moliSlot.adUnitPath,
            sizes: filterSupportedSizes(moliSlot.sizes).filter(this.isFixedSize)
          };
        })
      }, (_bids: Object[]) => {
        reportingService.measureAndReportA9BidsBack(currentRequestCount);
        window.apstag.setDisplayBids();
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
              return;
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

    const adSlot: googletag.IAdSlot = moliSlot.position === 'in-page' ?
      window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
      window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId);

    adSlot.setCollapseEmptyDiv(true);
    switch (env) {
      case 'production':
        adSlot.addService(window.googletag.pubads());
        break;
      case 'test':
        this.logger.warn(`Enabling content service on ${adSlot.getSlotElementId()}`);
        adSlot.addService(window.googletag.content());
    }


    this.logger.debug('DFP Service', `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
    return adSlot;
  }

  private displayAds(slots: SlotDefinition<Moli.AdSlot>[]): SlotDefinition<Moli.AdSlot>[] {
    slots.forEach((definition: SlotDefinition<Moli.AdSlot>) => this.displayAd(definition.moliSlot));
    return slots;
  }

  private displayAd(dfpSlot: Moli.AdSlot): void {
    this.logger.debug('DFP Service', `Display slot: [DomID] ${dfpSlot.domId} [AdUnitPath] ${dfpSlot.adUnitPath}`);
    window.googletag.display(dfpSlot.domId);
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
        slots.forEach(({ adSlot, moliSlot }) => {
          const containerId = `${moliSlot.domId}__container`;
          const containerWidthId = `${moliSlot.domId}__container_width`;
          const containerHeightId = `${moliSlot.domId}__container_height`;

          // pick a random, fixed sizes
          const sizes = moliSlot.sizes
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
            return `<button onclick="${resize}">${width}x${height}</button>`;
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
<div style="margin-bottom: 12px">
  <svg width="76px" height="76px" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fill-rule="evenodd">
        <path d="M0 71.875C0 70.84.814 70 1.819 70h54.729c1.006 0 1.821.84 1.821 1.875 0 1.035-.815 1.875-1.821 1.875H1.819C.814 73.75 0 72.91 0 71.875" fill="#A8ACAD"/>
        <path d="M64.042 45L61 47.889s2.585 6.844 6.995 3.955c0 0 1.065 3.498 2.433 2.737 1.369-.762 1.977-9.277-6.386-9.581" fill="#C24B48"/>
        <path d="M59.146 10.189a3.073 3.073 0 0 1-6.146 0V3.073a3.073 3.073 0 1 1 6.146 0v7.116zM68.903 68.956h-2.065a10.945 10.945 0 0 0 2.274-6.68V59.01c0-6.081-4.93-11.01-11.007-11.01h-1.097C50.931 48 46 52.929 46 59.01v3.266c0 4.402 2.591 8.188 6.324 9.949a6.437 6.437 0 0 0-.49 1.058h23.114c-.872-2.512-3.236-4.327-6.045-4.327" fill="#6A3230"/>
        <path d="M70.809 20.366h-6.703v-.812C64.106 13.173 58.934 8 52.552 8 46.174 8 41 13.173 41 19.554v41.369c0 6.382 5.174 11.553 11.552 11.553 6.382 0 11.554-5.171 11.554-11.553V31.63h3.369a5.626 5.626 0 0 0 5.58-4.922c.003-.012.004-.028.006-.041a4.62 4.62 0 0 0 .018-.165c.009-.079.025-.151.025-.237v-3.6a2.296 2.296 0 0 0-2.295-2.299" fill="#C24B48"/>
        <path d="M52 52.552v19.692c.294.023.589.046.89.046 6.383 0 11.556-5.174 11.556-11.554v-19.69a10.614 10.614 0 0 0-.893-.046C57.173 41 52 46.173 52 52.552" fill="#D87A7A"/>
        <g fill="#212222">
          <path d="M60.5 46l3.5-7h-7z"/>
          <path d="M60.5 43L63 61.947 60.623 67 58 61.947z"/>
        </g>
        <path d="M55.989 17.577c0 .901-.668 1.634-1.495 1.634-.826 0-1.494-.733-1.494-1.634v-1.945c0-.901.668-1.632 1.494-1.632.827 0 1.495.731 1.495 1.632v1.945zM60.988 17.577c0 .901-.668 1.634-1.493 1.634-.826 0-1.495-.733-1.495-1.634v-1.945c0-.901.669-1.632 1.495-1.632.825 0 1.493.731 1.493 1.632v1.945z" fill="#6A3230"/>
        <path d="M51.146 10.189a3.074 3.074 0 1 1-6.146 0V3.073a3.073 3.073 0 1 1 6.146 0v7.116z" fill="#C24B48"/>
        <path d="M73.781 20.924c0 1.063-.86 1.924-1.924 1.924h-.93A1.925 1.925 0 0 1 69 20.924c0-1.063.863-1.924 1.927-1.924h.93c1.064 0 1.924.861 1.924 1.924M64.351 32H57l7.351 8.375z" fill="#6A3230"/>
        <path d="M55.641 69.19h-2.064a10.944 10.944 0 0 0 2.273-6.68v-3.266c0-2.666-.948-5.11-2.524-7.015.887.274 1.91.185 3.057-.567 0 0 1.064 3.498 2.433 2.736 1.368-.76 1.976-9.276-6.387-9.58l-3.042 2.89s.386 1.02 1.112 2.104a10.935 10.935 0 0 0-5.656-1.578h-1.095c-.544 0-1.074.053-1.597.13l-.155-.156s-1.321-19.804-14.305-21.123C14.709 25.763 3.87 40.086 11.571 51.968c0 0 3.605-6.128 7.752-4.867 4.548 1.385 3.103 8.563 2.882 16.044-.219 7.481 7.752 10.372 19.11 10.372h20.372c-.871-2.512-3.237-4.327-6.046-4.327" fill="#C24B48"/>
        <path d="M57.43 39.188c1.27-.23.53 1.166-2.222 4.187-8.898-.854-13.778-2.365-14.64-4.532-.863-2.166-.742-3.447.363-3.843 9.73 3.022 15.23 4.418 16.5 4.188z" fill="#F3F3F3"/>
        <path fill="#E9E9E9" d="M62 39l6.146 3.885-4.497 1.326z"/>
        <rect fill="#F3F3F3" x="49" y="14" width="9" height="7" rx="3.5"/>
        <rect fill="#F3F3F3" x="58" y="14" width="9" height="7" rx="3.5"/>
        <path d="M51.5 15a1.5 1.5 0 0 0-1.5 1.5v2a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-2a1.5 1.5 0 0 0-1.5-1.5h-4zm0-1h4a2.5 2.5 0 0 1 2.5 2.5v2a2.5 2.5 0 0 1-2.5 2.5h-4a2.5 2.5 0 0 1-2.5-2.5v-2a2.5 2.5 0 0 1 2.5-2.5zM60.5 15a1.5 1.5 0 0 0-1.5 1.5v2a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-2a1.5 1.5 0 0 0-1.5-1.5h-4zm0-1h4a2.5 2.5 0 0 1 2.5 2.5v2a2.5 2.5 0 0 1-2.5 2.5h-4a2.5 2.5 0 0 1-2.5-2.5v-2a2.5 2.5 0 0 1 2.5-2.5zM49.059 14.92l-.212.977-9.141-1.99c-2.204-.839-2.61-.525-1.908 1.324l-.934.355c-1.041-2.736.254-3.734 3.126-2.634l9.069 1.968z" fill="#212222" fill-rule="nonzero"/>
      </g>
  </svg>
</div>
<div><h4><strong id="${containerWidthId}">${width}</strong>x<strong id="${containerHeightId}">${height}</strong> pixel</h4></div>
</div>`;

          window.googletag.content().setContent(adSlot, html);
        });
        break;
      case 'production':
        window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
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
      slot.behaviour === 'lazy' ||
      slot.behaviour === 'refreshable' && ((slot as Moli.RefreshableAdSlot).lazy || false)
    );
  }

  private isValidTrigger(trigger: Moli.behaviour.Trigger): boolean {
    return !(typeof trigger.source === 'string') || !!document.querySelector(trigger.source);
  }

  /**
   * Decides which sizeConfigService to use - if the slot brings its own sizeConfig, it gets precedence over the
   * global one.
   *
   * @param moliSlot the ad slot
   * @param globalSizeConfigService the global sizeConfigService
   */
  private getSizeFilterFunction(moliSlot: Moli.AdSlot): FilterSupportedSizes {
    return (givenSizes: DfpSlotSize[]) => new SizeConfigService(moliSlot.sizeConfig).filterSupportedSizes(givenSizes);
  }

  private isLazySlot(slot: Moli.AdSlot): slot is Moli.LazyAdSlot {
    return slot.behaviour === 'lazy';
  }

  private isLazyRefreshableAdSlot(slot: Moli.AdSlot): slot is Moli.RefreshableAdSlot {
    return slot.behaviour === 'refreshable' && ((slot as Moli.RefreshableAdSlot).lazy || false);
  }

  private isRefreshableAdSlotDefinition(slotDefinition: SlotDefinition<Moli.AdSlot>): slotDefinition is SlotDefinition<Moli.RefreshableAdSlot> {
    return slotDefinition.moliSlot.behaviour === 'refreshable';
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
