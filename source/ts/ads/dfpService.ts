import domready = require('domready');

import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import '../types/apstag';
import { ICookieService } from '../util/cookieService';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { createLazyLoader } from './lazyLoading';
import { createRefreshListener } from './refreshAd';
import { Moli } from '../types/moli';
import { SizeConfigService } from './sizeConfigService';
import DfpKeyValueMap = Moli.DfpKeyValueMap;

/**
 * Combines the dfp slot definition along with the actual googletag.IAdSlot definition.
 */
interface ISlotDefinition<S extends Moli.AdSlot> {
  /** The dfp slot definition */
  readonly dfpSlot: S;

  /** The actual dfp slot returned by the googletag script */
  readonly adSlot: googletag.IAdSlot;
}

declare const window: Window;

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
   *
   * @param assetService - Currently needed to load amazon
   * @param cookieService - Access browser cookies
   */
  constructor(private assetService: IAssetLoaderService,
              private cookieService: ICookieService) {

    // initialize the logger with a default one
    this.logger = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
  }

  /**
   * Initializes and shows ads
   *
   * @param config - the ad configuration
   * @return {Promise<void>}   a promise resolving when the first ad is shown OR a timeout occurs
   */
  public initialize = (config: Moli.MoliConfig): Promise<void> => {
    if (this.initialized) {
      return Promise.reject('Already initialized');
    }
    this.initialized = true;

    // override the fallback logger
    if (config.logger) {
      this.logger = config.logger;
    }

    const extraLabels = config.targeting && config.targeting.labels ? config.targeting.labels : [];
    const sizeConfigService = new SizeConfigService(config.sizeConfig || [], extraLabels, this.logger);

    // a9 script overwrites the window.apstag completely on script load
    if (config.a9) {
      this.initApstag();
      this.loadA9Script(config); // load a9 script, but we don't have to wait until loaded
    }
    const prebidReady = config.prebid ?
      this.awaitPrebidLoaded().then(() => this.configurePrebid(window.pbjs, config)) :
      Promise.resolve();

    const slots = config.slots
      .filter(slot => sizeConfigService.filterSlot(slot));

    const dfpReady = this.awaitGptLoaded()
      .then(() => this.awaitDomReady())
      .then(() => this.configureAdNetwork(config.targeting ? config.targeting.keyValues : {}));

    // concurrently initialize lazy loaded slots and refreshable slots
    const lazySlots: Promise<Moli.LazyAdSlot[]> = dfpReady.then(() => slots.filter(this.isLazySlot));
    prebidReady.then(() => {
      this.initRefreshableSlots(eagerlyLoadedSlots, config);
      this.initLazyLoadedSlots(lazySlots, config);
    });

    // eagerly displayed slots
    const eagerlyLoadedSlots = dfpReady
    // request all existing and non-lazy loading slots
      .then(() => this.filterAvailableSlots(slots).filter(slot => !this.isLazySlot(slot)))
      // configure slots with gpt
      .then((availableSlots: Moli.AdSlot[]) => this.registerSlots(availableSlots))
      .then((registeredSlots: ISlotDefinition<Moli.AdSlot>[]) => this.displayAds(registeredSlots));

    // We wait for a prebid response and then refresh.
    const refreshedAds: Promise<ISlotDefinition<Moli.AdSlot>[]> = prebidReady
      .then(() => eagerlyLoadedSlots)
      .then(slotDefinitions => this.initHeaderBidding(slotDefinitions, config))
      .then((adSlots: ISlotDefinition<Moli.AdSlot>[]) => this.refreshAds(adSlots));

    return refreshedAds
      .then(() => {
        return;
      })
      .catch(reason => {
        this.logger.error('DfpService :: Initialization failed' + JSON.stringify(reason));
        return Promise.reject(reason);
      });
  };

  /**
   * Lazy loaded slots.
   *
   * A lazy loaded slot can contain any other slot. This includes prebid (header bidding) slots.
   * This method handles
   *
   * @param {Promise<Moli.LazyAdSlot[]>} lazyLoadingSlots
   * @param {Moli.MoliConfig} config
   */
  private initLazyLoadedSlots(lazyLoadingSlots: Promise<Moli.LazyAdSlot[]>, config: Moli.MoliConfig): void {
    lazyLoadingSlots
      .then((lazySlots: Moli.LazyAdSlot[]) => lazySlots.forEach((dfpSlotLazy) => {

        createLazyLoader(dfpSlotLazy.trigger).onLoad()
          .then(() => {
            if (document.getElementById(dfpSlotLazy.domId)) {
              return Promise.resolve();
            }
            return Promise.reject(`DfpService: lazy slot dom element not available: ${dfpSlotLazy.adUnitPath} / ${dfpSlotLazy.domId}`);
          })
          .then(() => this.registerSlot(dfpSlotLazy))
          .then(adSlot => {
            const slotDefinition: ISlotDefinition<Moli.AdSlot> = { adSlot, dfpSlot: dfpSlotLazy };
            // check if the lazy slot wraps a prebid slot and request prebid too
            // only executes the necessary parts of `this.initHeaderBidding`

            const bidRequests: Promise<unknown>[] = [];

            if (dfpSlotLazy.prebid) {
              bidRequests.push(this.initPrebid([ { adSlot, dfpSlot: dfpSlotLazy as Moli.PrebidAdSlot } ], config));
            }

            if (dfpSlotLazy.a9) {
              bidRequests.push(this.fetchA9Slots([ dfpSlotLazy as Moli.A9AdSlot ], config));
            }

            return Promise.all(bidRequests).then(() => slotDefinition);
          })
          .then(({ adSlot, dfpSlot }) => {
            window.googletag.pubads().refresh([ adSlot ]);
          })
          .catch(error => {
            this.logger.error(error);
          });
      }));
  }

  /**
   * Refreshable slots.
   *
   * A refreshable slot can contain any other slot. This includes prebid (header bidding) and lazy loading slots.
   *
   * @param {Promise<ISlotDefinition<Moli.AdSlot>[]>} displayedAdSlots
   * @param {Moli.MoliConfig} config
   */
  private initRefreshableSlots(displayedAdSlots: Promise<ISlotDefinition<Moli.AdSlot>[]>, config: Moli.MoliConfig): void {
    displayedAdSlots
      .then(registrations => registrations.filter(this.isRefreshableAdSlotDefinition))
      .then((refreshableSlots: ISlotDefinition<Moli.RefreshableAdSlot>[]) => refreshableSlots.forEach(({ adSlot, dfpSlot }) => {
        createRefreshListener(dfpSlot.trigger).addAdRefreshListener(() => {
          const bidRequests: Promise<unknown>[] = [];

          if (dfpSlot.prebid) {
            const refreshPrebidSlot = this.requestPrebid([ { adSlot, dfpSlot: dfpSlot as Moli.PrebidAdSlot } ])
              .catch(reason => {
                this.logger.warn(reason);
                return {};
              });
            bidRequests.push(refreshPrebidSlot);
          }

          if (dfpSlot.a9) {
            bidRequests.push(this.fetchA9Slots([ dfpSlot as Moli.A9AdSlot ], config));
          }

          Promise.all(bidRequests)
            .then(() => {
              window.googletag.pubads().refresh([ adSlot ]);
            });
        });
      }))
      .catch((error) => {
        this.logger.error(`refreshable ad slot initialization failed with ${error}`);
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
   * @param availableSlots
   * @returns returns the unaltered adSlot definitions
   */
  private initHeaderBidding(availableSlots: ISlotDefinition<Moli.AdSlot>[], config: Moli.MoliConfig): Promise<ISlotDefinition<Moli.AdSlot>[]> {
    this.logger.debug('DFP activate header bidding');

    const prebidSlots: ISlotDefinition<Moli.PrebidAdSlot>[] = availableSlots.filter(this.isPrebidSlotDefinition);
    const a9Slots: ISlotDefinition<Moli.A9AdSlot>[] = availableSlots.filter(this.isA9SlotDefinition);

    return Promise.all([ this.initA9(a9Slots, config), this.initPrebid(prebidSlots, config) ])
      .then(() => availableSlots);
  }

  /**
   * Initialize the given prebid slots. The retuned promise is fulfilled when
   *
   * - prebid.js has been loaded completely
   * - all prebid slots have been registered
   * - all prebid slot have been requested
   *
   * @param prebidSlots all slots - will be filtered for prebid slots
   * @param config full ad configuration
   * @returns the bid response map. Always empty if not prebid slots are requested
   */
  private initPrebid(prebidSlots: ISlotDefinition<Moli.PrebidAdSlot>[], config: Moli.MoliConfig): Promise<prebidjs.IBidResponsesMap> {
    if (prebidSlots.length === 0) {
      return Promise.resolve({});
    }

    if (!config.prebid) {
      this.logger.warn(`Try to init ${prebidSlots.length} without a prebid configuration`, prebidSlots);
      return Promise.resolve({});
    }


    return Promise.resolve()
      .then(() => this.registerPrebidSlots(prebidSlots, config))
      .then(() => this.requestPrebid(prebidSlots))
      .catch(reason => {
        this.logger.warn(reason);
        return {};
      });
  }

  private configurePrebid(pbjs: prebidjs.IPrebidJs, config: Moli.MoliConfig): Promise<void> {
    return new Promise<Moli.headerbidding.PrebidConfig>((resolve, reject) => {
      config.prebid ? resolve(config.prebid) : reject('Configure prebid without a prebid configuration is not allowed');
    }).then(prebidConfig => {
      pbjs.setConfig(prebidConfig.config);
      if (prebidConfig.bidderSettings) {
        window.pbjs.bidderSettings = prebidConfig.bidderSettings;
      }
    });
  }

  private initA9(a9Slots: ISlotDefinition<Moli.A9AdSlot>[], config: Moli.MoliConfig): Promise<void> {
    if (a9Slots.length === 0) {
      return Promise.resolve();
    }

    // no a9 configured
    if (!config.a9) {
      this.logger.warn(`Try to init ${a9Slots.length} without a prebid configuration`, a9Slots);
      return Promise.resolve();
    }

    return Promise.resolve(a9Slots)
      .then((slots: ISlotDefinition<Moli.A9AdSlot>[]) => slots.map(slot => slot.dfpSlot))
      .then((slots: Moli.A9AdSlot[]) => this.fetchA9Slots(slots, config))
      .catch(reason => this.logger.warn(reason));
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

  private awaitPrebidLoaded(): Promise<void> {
    window.pbjs = window.pbjs || { que: [] };
    return new Promise(resolve => window.pbjs.que.push(resolve));
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

  private configureAdNetwork(keyValueMap: DfpKeyValueMap): void {

    Object.keys(keyValueMap).forEach(key => {
      const value = keyValueMap[key];
      if (value) {
        window.googletag.pubads().setTargeting(key, value);
      }
    });


    window.googletag.pubads().enableAsyncRendering();
    window.googletag.pubads().disableInitialLoad();
    window.googletag.pubads().enableSingleRequest();
    window.googletag.enableServices();
  }

  private filterAvailableSlots(slots: Moli.AdSlot[]): Moli.AdSlot[] {
    return slots.filter((slot: Moli.AdSlot) => !!document.getElementById(slot.domId));
  }

  /**
   * Register prebid slots with pbjs.
   *
   * @param dfpPrebidSlots that should be registered
   * @returns the unaltered prebid slots
   */
  private registerPrebidSlots(dfpPrebidSlots: ISlotDefinition<Moli.PrebidAdSlot>[], config: Moli.MoliConfig): void {
    const slots = dfpPrebidSlots.map(slot => slot.dfpSlot);
    window.pbjs.addAdUnits(slots.map((slot: Moli.PrebidAdSlot) => {
      const keyValues = config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {};
      const prebidAdSlotConfig = (typeof slot.prebid === 'function') ? slot.prebid({ keyValues: keyValues }) : slot.prebid;

      return {
        code: slot.domId,
        mediaTypes: prebidAdSlotConfig.adUnit.mediaTypes,
        bids: prebidAdSlotConfig.adUnit.bids
      };
    }));
  }

  private fetchA9Slots(slots: Moli.A9AdSlot[], config: Moli.MoliConfig): Promise<void> {
    if (slots.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      window.apstag.fetchBids({
        slots: slots.map(slot => {
          return {
            slotID: slot.domId,
            slotName: slot.adUnitPath,
            sizes: slot.sizes.filter(this.isFixedSize)
          };
        }),
        timeout: config.a9 ? config.a9.timeout : 1000
      }, (_bids: Object[]) => {
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
  private requestPrebid(slotDefinitions: ISlotDefinition<Moli.AdSlot>[]): Promise<prebidjs.IBidResponsesMap> {
    return new Promise<prebidjs.IBidResponsesMap>(resolve => {
      // It seems that the bidBackHandler can be triggered more than once. The reason might be that
      // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
      // afterwards anyway the bidsBackHandler is called a second time.
      let adserverRequestSent = false;

      const dfpSlots = slotDefinitions.map(slot => slot.dfpSlot);
      const adUnitCodes = dfpSlots.map(slot => slot.domId);

      window.pbjs.requestBids({
        adUnitCodes: adUnitCodes,
        bidsBackHandler: (bidResponses: prebidjs.IBidResponsesMap, _timedOut: boolean) => {
          // the bids back handler seems to run on a different thread
          // in consequence, we need to catch errors here to propagate them to top levels
          try {
            if (adserverRequestSent) {
              return;
            }

            adserverRequestSent = true;

            // set key-values for DFP to target the correct line items
            window.pbjs.setTargetingForGPTAsync(adUnitCodes);

            resolve(bidResponses);
          } catch (error) {
            this.logger.error('DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error));
            resolve({});
          }
        }
      });
    });

  }


  private registerSlots(slots: Moli.AdSlot[]): ISlotDefinition<Moli.AdSlot>[] {
    if (slots.length === 0) {
      // todo : tracking if answer displayed but no ad slot created - GF-6632
      this.logger.debug('No DFP ads displayed!');
    }

    return slots.map((slot: Moli.AdSlot) => {
      return { dfpSlot: slot, adSlot: this.registerSlot(slot) };
    });
  }

  private registerSlot(dfpSlot: Moli.AdSlot): googletag.IAdSlot {
    const adSlot: googletag.IAdSlot = dfpSlot.position === 'in-page' ?
      window.googletag.defineSlot(dfpSlot.adUnitPath, dfpSlot.sizes, dfpSlot.domId) :
      window.googletag.defineOutOfPageSlot(dfpSlot.adUnitPath, dfpSlot.domId);

    adSlot.setCollapseEmptyDiv(true);
    adSlot.addService(window.googletag.pubads());
    return adSlot;
  }

  private displayAds(slots: ISlotDefinition<Moli.AdSlot>[]): ISlotDefinition<Moli.AdSlot>[] {
    slots.forEach((definition: ISlotDefinition<Moli.AdSlot>) => this.displayAd(definition.dfpSlot));
    return slots;
  }

  private displayAd(dfpSlot: Moli.AdSlot): void {
    this.logger.debug(`Displaying ${dfpSlot.domId}`);
    window.googletag.display(dfpSlot.domId);
  }

  /**
   * Refresh all the passed slots
   * @param slots - the slots that should be refreshed
   * @returns {ISlotDefinition[]} unaltered
   */
  private refreshAds(slots: ISlotDefinition<Moli.AdSlot>[]): ISlotDefinition<Moli.AdSlot>[] {
    window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
    return slots;
  }

  private isLazySlot(slot: Moli.AdSlot): slot is Moli.LazyAdSlot {
    return slot.behaviour === 'lazy';
  }

  private isRefreshableAdSlotDefinition(slotDefinition: ISlotDefinition<Moli.AdSlot>): slotDefinition is ISlotDefinition<Moli.RefreshableAdSlot> {
    return slotDefinition.dfpSlot.behaviour === 'refreshable';
  }

  private isPrebidSlotDefinition(slotDefinition: ISlotDefinition<Moli.AdSlot>): slotDefinition is ISlotDefinition<Moli.PrebidAdSlot> {
    return !!slotDefinition.dfpSlot.prebid;
  }

  private isA9SlotDefinition(slotDefinition: ISlotDefinition<Moli.AdSlot>): slotDefinition is ISlotDefinition<Moli.A9AdSlot> {
    return !!slotDefinition.dfpSlot.a9;
  }

  private isFixedSize(size: Moli.DfpSlotSize): size is [ number, number ] {
    return size !== 'fluid';
  }
}
