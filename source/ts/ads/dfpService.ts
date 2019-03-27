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
      return Promise.reject('Already initialized');
    }
    this.initialized = true;

    this.logger = getLogger(config);

    // always create performance marks and metrics even without a config
    const reportingConfig: Moli.reporting.ReportingConfig = config.reporting || {
      reporters: [],
      sampleRate: 0
    };
    this.reportingService = new ReportingService(performanceMeasurementService, reportingConfig, this.logger);

    // a9 script overwrites the window.apstag completely on script load
    if (config.a9) {
      this.initApstag();
      this.loadA9Script(config); // load a9 script, but we don't have to wait until loaded
    }

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    const prebidReady = config.prebid ?
      this.awaitPrebidLoaded(prebidGlobal).then(() => this.configurePrebid(window[ prebidGlobal ], config)) :
      Promise.resolve();


    const dfpReady =
      this.awaitDomReady()
        .then(() => this.awaitGptLoaded())
        .then(() => this.configureCmp(config, this.reportingService!))
        // initialize the reporting for non-lazy slots
        .then(() => this.configureAdNetwork(config))
        .catch(error => {
          this.logger.error('failed configuring gpt', error);
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
    if (!this.initialized || !this.reportingService) {
      return Promise.reject('Not initialized yet.');
    }

    const extraLabels = config.targeting && config.targeting.labels ? config.targeting.labels : [];
    const globalSizeConfigService = new SizeConfigService(config.sizeConfig || [], extraLabels);

    const filteredSlots = config.slots
      .filter(slot => globalSizeConfigService.filterSlot(slot));

    this.reportingService.initialize(
      this.filterAvailableSlots(filteredSlots).filter(this.isInstantlyLoadedSlot));

    const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';

    // concurrently initialize lazy loaded slots and refreshable slots
    this.initLazyRefreshableSlots(window[ prebidGlobal ], filteredSlots.filter(this.isLazyRefreshableAdSlot), config, this.reportingService, globalSizeConfigService);
    this.initLazyLoadedSlots(window[ prebidGlobal ], filteredSlots.filter(this.isLazySlot), config, this.reportingService, globalSizeConfigService);

    // eagerly displayed slots - this includes 'eager' slots and non-lazy 'refreshable' slots
    return Promise.resolve()
    // request all existing and non-lazy loading slots
      .then(() => this.filterAvailableSlots(filteredSlots).filter(this.isInstantlyLoadedSlot))
      // configure slots with gpt
      .then((availableSlots: Moli.AdSlot[]) => this.registerSlots(availableSlots, globalSizeConfigService))
      .then((registeredSlots: SlotDefinition<Moli.AdSlot>[]) => this.displayAds(registeredSlots))
      .then((registeredSlots) => {
        this.initRefreshableSlots(window[ prebidGlobal ], registeredSlots.filter(this.isRefreshableAdSlotDefinition), config, this.reportingService!, globalSizeConfigService);
        return registeredSlots;
      })
      // We wait for a prebid response and then refresh.
      .then(slotDefinitions => this.initHeaderBidding(window[ prebidGlobal ], slotDefinitions, config, this.reportingService!, globalSizeConfigService))
      .then(slotDefinitions => this.refreshAds(slotDefinitions, this.reportingService!))
      .then(slotDefinitions => slotDefinitions.map(slot => slot.moliSlot))
      .catch(reason => {
        this.logger.error('DfpService :: Initialization failed: ' + JSON.stringify(reason), reason);
        return Promise.reject(reason);
      });

  };

  public destroyAdSlots = (config: Moli.MoliConfig): Promise<Moli.MoliConfig> => {
    if (!this.initialized) {
      return Promise.reject('Not initialized yet.');
    }

    return Promise.resolve()
      .then(() => window.googletag.destroySlots())
      .then(() => {
        const prebidGlobal = config.prebid && config.prebid.useMoliPbjs ? 'moliPbjs' : 'pbjs';
        const pbjs = window[prebidGlobal];
        this.logger.debug(`Destroying prebid adUnits`, pbjs.adUnits);
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

    if (cmpConfig) {
      switch (cmpConfig.provider) {
        case 'publisher' : {
          return Promise.resolve();
        }
        case 'faktor' : {
          const faktorCmp = new FaktorCmp(reportingService);
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
   * @param globalSizeConfigService filter supported sizes
   */
  private initLazyLoadedSlots(
    pbjs: prebidjs.IPrebidJs,
    lazyLoadingSlots: Moli.LazyAdSlot[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService
  ): void {
    lazyLoadingSlots.forEach((moliSlotLazy) => {
      const filterSupportedSizes = this.getSizeFilterFunction(moliSlotLazy, globalSizeConfigService);

      createLazyLoader(moliSlotLazy.trigger).onLoad()
        .then(() => {
          if (document.getElementById(moliSlotLazy.domId)) {
            return Promise.resolve();
          }
          return Promise.reject(`DfpService: lazy slot dom element not available: ${moliSlotLazy.adUnitPath} / ${moliSlotLazy.domId}`);
        })
        .then(() => this.registerSlot({ moliSlot: moliSlotLazy, filterSupportedSizes }))
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
            } ], config, reportingService, globalSizeConfigService));
          }

          if (moliSlotLazy.a9) {
            bidRequests.push(this.fetchA9Slots([ {
              ...slotDefinition,
              moliSlot: moliSlotLazy as Moli.A9AdSlot
            } ], config, reportingService, globalSizeConfigService));
          }

          return Promise.all(bidRequests).then(() => slotDefinition);
        })
        .then(({ adSlot }) => {
          window.googletag.pubads().refresh([ adSlot ]);
        })
        .catch(error => {
          this.logger.error(`Failed to initialized lazy loading slot ${moliSlotLazy.adUnitPath} | ${moliSlotLazy.domId}`, error);
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
   * @param globalSizeConfigService required for labels
   */
  private initRefreshableSlots(
    pbjs: prebidjs.IPrebidJs,
    registeredSlots: SlotDefinition<Moli.RefreshableAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService
  ): void {
    registeredSlots
      .filter(({ moliSlot }) => this.isValidTrigger(moliSlot.trigger))
      .forEach((slotDefinition) => {
        try {
          createRefreshListener(slotDefinition.moliSlot.trigger).addAdRefreshListener(() => {
            this.requestRefreshableSlot(pbjs, slotDefinition, config, reportingService, globalSizeConfigService);
          });
        } catch (e) {
          this.logger.warn(`DfpService:: creating refreshable slots failed for slot ${slotDefinition.moliSlot.adUnitPath}`, e);
        }
      });
  }

  private initLazyRefreshableSlots(
    pbjs: prebidjs.IPrebidJs,
    lazyRefreshableSlots: Moli.RefreshableAdSlot[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService
  ): void {
    lazyRefreshableSlots
      .filter((moliSlot) => this.isValidTrigger(moliSlot.trigger))
      .forEach((moliSlotRefreshable) => {
        const filterSupportedSizes = this.getSizeFilterFunction(moliSlotRefreshable, globalSizeConfigService);
        try {

          let adSlot: googletag.IAdSlot;
          createRefreshListener(moliSlotRefreshable.trigger).addAdRefreshListener(() => {
            if (!adSlot) {
              // ad slot has not been registered yet
              adSlot = this.registerSlot({ moliSlot: moliSlotRefreshable, filterSupportedSizes });
              if (this.isPrebidSlot(moliSlotRefreshable)) {
                // make sure that the slot is also registered on prebid
                this.registerPrebidSlots(pbjs, [ {
                  moliSlot: moliSlotRefreshable,
                  filterSupportedSizes,
                  adSlot
                } ], config, globalSizeConfigService);
              }
              this.displayAd(moliSlotRefreshable);
            }
            this.requestRefreshableSlot(
              pbjs,
              { moliSlot: moliSlotRefreshable, adSlot, filterSupportedSizes },
              config,
              reportingService,
              globalSizeConfigService
            );
          });
        } catch (e) {
          this.logger.warn(`DfpService:: creating lazy refreshable slots failed ${moliSlotRefreshable.adUnitPath}`, e);
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
   * @param globalSizeConfigService
   */
  private requestRefreshableSlot(
    pbjs: prebidjs.IPrebidJs,
    slotDefinition: SlotDefinition<RefreshableAdSlot>,
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService): void {
    const bidRequests: Promise<unknown>[] = [];

    const { moliSlot, adSlot, filterSupportedSizes } = slotDefinition;

    if (this.isPrebidSlot(moliSlot)) {
      const refreshPrebidSlot = this.requestPrebid(pbjs, [ {
        adSlot,
        moliSlot,
        filterSupportedSizes
      } ], config, reportingService, globalSizeConfigService)
        .catch(reason => {
          this.logger.warn(`Failed to request refreshable slot ${moliSlot.adUnitPath} | ${moliSlot.domId}`, reason);
          return {};
        });
      bidRequests.push(refreshPrebidSlot);
    }

    if (this.isA9Slot(moliSlot)) {
      bidRequests.push(this.fetchA9Slots([ {
        ...slotDefinition,
        moliSlot: moliSlot
      } ], config, reportingService, globalSizeConfigService));
    }

    Promise.all(bidRequests)
      .then(() => {
        this.refreshAds([ slotDefinition ], reportingService);
      }).catch((error) => {
      this.logger.error(`refreshable ad slot (${moliSlot.adUnitPath}) initialization failed with ${error}`);
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
   * @param globalSizeConfigService required for labels
   * @returns returns the unaltered adSlot definitions
   */
  private initHeaderBidding(
    pbjs: prebidjs.IPrebidJs,
    availableSlots: SlotDefinition<Moli.AdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService
  ): Promise<SlotDefinition<Moli.AdSlot>[]> {
    this.logger.debug('DFP activate header bidding');

    const prebidSlots: SlotDefinition<Moli.PrebidAdSlot>[] = availableSlots.filter(this.isPrebidSlotDefinition);
    const a9Slots: SlotDefinition<Moli.A9AdSlot>[] = availableSlots.filter(this.isA9SlotDefinition);

    return Promise.all([ this.initA9(a9Slots, config, reportingService, globalSizeConfigService), this.initPrebid(pbjs, prebidSlots, config, reportingService, globalSizeConfigService) ])
      .then(() => availableSlots);
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
   * @param globalSizeConfigService required for labels and prebid sizes
   * @returns the bid response map. Always empty if not prebid slots are requested
   */
  private initPrebid(
    pbjs: prebidjs.IPrebidJs,
    prebidSlots: SlotDefinition<Moli.PrebidAdSlot>[],
    config: Moli.MoliConfig,
    reportingService: ReportingService,
    globalSizeConfigService: SizeConfigService
  ): Promise<prebidjs.IBidResponsesMap> {
    if (prebidSlots.length === 0) {
      return Promise.resolve({});
    }

    if (!config.prebid) {
      this.logger.warn(`Try to init ${prebidSlots.length} prebid slots without a prebid configuration`, prebidSlots);
      return Promise.resolve({});
    }

    return Promise.resolve()
      .then(() => this.registerPrebidSlots(pbjs, prebidSlots, config, globalSizeConfigService))
      .then(() => this.requestPrebid(pbjs, prebidSlots, config, reportingService, globalSizeConfigService))
      .catch(reason => {
        this.logger.warn('init prebid failed', reason);
        return {};
      });
  }

  private configurePrebid(pbjs: prebidjs.IPrebidJs, config: Moli.MoliConfig): Promise<void> {
    return new Promise<Moli.headerbidding.PrebidConfig>((resolve, reject) => {
      config.prebid ? resolve(config.prebid) : reject('Configure prebid without a prebid configuration is not allowed');
    }).then(prebidConfig => {
      pbjs.setConfig(prebidConfig.config);
      if (prebidConfig.bidderSettings) {
        pbjs.bidderSettings = prebidConfig.bidderSettings;
      }
    });
  }

  private initA9(a9Slots: SlotDefinition<Moli.A9AdSlot>[], config: Moli.MoliConfig, reportingService: ReportingService, globalSizeConfigService: SizeConfigService): Promise<void> {
    if (a9Slots.length === 0) {
      return Promise.resolve();
    }

    // no a9 configured
    if (!config.a9) {
      this.logger.warn(`Try to init ${a9Slots.length} a9 slots without a a9 configuration`, a9Slots);
      return Promise.resolve();
    }

    return Promise.resolve(a9Slots)
      .then((slots: SlotDefinition<Moli.A9AdSlot>[]) => this.fetchA9Slots(slots, config, reportingService, globalSizeConfigService))
      .catch(reason => this.logger.warn('init A9 failed', reason));
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
    window[ prebidGlobal ] = window[ prebidGlobal ] || { que: [] };
    return new Promise(resolve => window[ prebidGlobal ].que.push(resolve));
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
      return Promise.reject('a9 initialized without a configuration');
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

  private configureAdNetwork(config: Moli.MoliConfig): Promise<void> {

    const keyValueMap = config.targeting ? config.targeting.keyValues : {};

    Object.keys(keyValueMap).forEach(key => {
      const value = keyValueMap[ key ];
      if (value) {
        window.googletag.pubads().setTargeting(key, value);
      }
    });

    window.googletag.pubads().enableAsyncRendering();
    window.googletag.pubads().disableInitialLoad();
    window.googletag.pubads().enableSingleRequest();

    return getPersonalizedAdSetting(config.consent).then(nonPersonalizedAds => {
      this.logger.debug(`googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
      if (nonPersonalizedAds) {
        this.logger.debug('Serve non-personalized ads');
      }
      window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);
      window.googletag.enableServices();
    });
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
   * @param globalSizeConfigService - filter prebid ad unit objects (bids) by label
   * @returns the unaltered prebid slots
   */
  private registerPrebidSlots(pbjs: prebidjs.IPrebidJs, dfpPrebidSlots: SlotDefinition<Moli.PrebidAdSlot>[], config: Moli.MoliConfig, globalSizeConfigService: SizeConfigService): void {
    pbjs.addAdUnits(dfpPrebidSlots.map(({ moliSlot, filterSupportedSizes }) => {
      const keyValues = config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {};
      const prebidAdSlotConfig = (typeof moliSlot.prebid === 'function') ? moliSlot.prebid({ keyValues: keyValues }) : moliSlot.prebid;
      const mediaTypeBanner = prebidAdSlotConfig.adUnit.mediaTypes.banner;
      const mediaTypeVideo = prebidAdSlotConfig.adUnit.mediaTypes.video;

      const bannerSizes = mediaTypeBanner ? filterSupportedSizes(mediaTypeBanner.sizes).filter(this.isFixedSize) : [];
      const videoSizes = mediaTypeVideo ? this.filterVideoPlayerSizes(mediaTypeVideo.playerSize, filterSupportedSizes) : [];

      // filter bids ourselves and don't rely on prebid to have a stable API
      const bids = prebidAdSlotConfig.adUnit.bids.filter(bid => globalSizeConfigService.filterSlot(bid));

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

  private fetchA9Slots(slots: Moli.SlotDefinition<Moli.A9AdSlot>[], config: Moli.MoliConfig, reportingService: ReportingService, globalSizeConfigService: SizeConfigService): Promise<void> {
    const filteredSlots = slots.filter(slot => globalSizeConfigService.filterSlot(slot.moliSlot.a9));

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
    globalSizeConfigService: SizeConfigService
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

      reportingService.markPrebidSlotsRequested(currentRequestCount);
      pbjs.requestBids({
        adUnitCodes: adUnitCodes,
        labels: globalSizeConfigService.getSupportedLabels(),
        bidsBackHandler: (bidResponses?: prebidjs.IBidResponsesMap, timedOut?: boolean) => {
          // the bids back handler seems to run on a different thread
          // in consequence, we need to catch errors here to propagate them to top levels
          try {
            if (adserverRequestSent) {
              return;
            }

            if (!bidResponses) {
              this.logger.warn(`Undefined bid response map for ad unit codes: ${adUnitCodes.join(', ')}`);
              return;
            }

            adserverRequestSent = true;
            reportingService.measureAndReportPrebidBidsBack(currentRequestCount);

            // execute listener
            if (config.prebid && config.prebid.listener && config.prebid.listener.preSetTargetingForGPTAsync) {
              try {
                config.prebid.listener.preSetTargetingForGPTAsync(bidResponses, timedOut || false, slotDefinitions);
              } catch (e) {
                this.logger.error(`Failed to execute prebid preSetTargetingForGPTAsync listener. ${e}`);
              }
            }

            // set key-values for DFP to target the correct line items
            pbjs.setTargetingForGPTAsync(adUnitCodes);

            resolve(bidResponses);
          } catch (error) {
            this.logger.error('DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error));
            resolve({});
          }
        }
      });
    });

  }

  private registerSlots(slots: Moli.AdSlot[], globalSizeConfigService: SizeConfigService): SlotDefinition<Moli.AdSlot>[] {
    if (slots.length === 0) {
      this.logger.debug('No DFP ads displayed!');
    }

    return slots.map((moliSlot: Moli.AdSlot) => {
      const filterSupportedSizes = this.getSizeFilterFunction(moliSlot, globalSizeConfigService);
      const googleTagAdSlot = this.registerSlot({ moliSlot, filterSupportedSizes });

      return { moliSlot: moliSlot, adSlot: googleTagAdSlot, filterSupportedSizes };
    });
  }

  private registerSlot(slotDefinition: Pick<SlotDefinition<Moli.AdSlot>, 'moliSlot' | 'filterSupportedSizes'>): googletag.IAdSlot {
    const { moliSlot, filterSupportedSizes } = slotDefinition;
    const sizes = filterSupportedSizes(moliSlot.sizes);

    const adSlot: googletag.IAdSlot = moliSlot.position === 'in-page' ?
      window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
      window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId);

    adSlot.setCollapseEmptyDiv(true);
    adSlot.addService(window.googletag.pubads());
    return adSlot;
  }

  private displayAds(slots: SlotDefinition<Moli.AdSlot>[]): SlotDefinition<Moli.AdSlot>[] {
    slots.forEach((definition: SlotDefinition<Moli.AdSlot>) => this.displayAd(definition.moliSlot));
    return slots;
  }

  private displayAd(dfpSlot: Moli.AdSlot): void {
    this.logger.debug(`Displaying ${dfpSlot.domId}`);
    window.googletag.display(dfpSlot.domId);
  }

  /**
   * Refresh all the passed slots
   * @param slots - the slots that should be refreshed
   * @param reportingService - used to mark the refresh call of a service
   * @returns {SlotDefinition[]} unaltered
   */
  private refreshAds(slots: SlotDefinition<Moli.AdSlot>[], reportingService: ReportingService): SlotDefinition<Moli.AdSlot>[] {
    window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
    slots.forEach(slot => {
      this.logger.debug(`Refresh ad slot ${slot.moliSlot.domId}`);
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
  private getSizeFilterFunction(moliSlot: Moli.AdSlot, globalSizeConfigService: SizeConfigService): FilterSupportedSizes {
    return moliSlot.sizeConfig ?
      (givenSizes: DfpSlotSize[]) => new SizeConfigService(moliSlot.sizeConfig!, []).filterSupportedSizes(givenSizes) :
      (givenSizes: DfpSlotSize[]) => globalSizeConfigService.filterSupportedSizes(givenSizes);
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
    return size.length === 2 && typeof size[ 0 ] === 'number' && typeof size[ 1 ] === 'number';
  }

  /**
   * Filters video player sizes according to the sizeConfig; if it is a single tuple ([number, number]), then this
   * single tuple is checked and returned, if it fits. If it's an array of sizes, the array is checked and the fitting
   * entries are returned.
   *
   * @param playerSize the (array of) player size(s)
   * @param filterSupportedSizes function provided by the global or slot-local sizeConfig to filter the slot's sizes
   */
  private filterVideoPlayerSizes(playerSize: prebidjs.IMediaTypeVideo['playerSize'], filterSupportedSizes: FilterSupportedSizes): [ number, number ][] {
    return filterSupportedSizes(
      this.isSinglePlayerSize(playerSize) ? [ playerSize ] : playerSize
    ).filter(this.isFixedSize);
  }
}
