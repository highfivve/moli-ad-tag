import domready = require('domready');

import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import  '../types/apstag';
import { cookieService, ICookieService } from '../util/cookieService';
import { assetLoaderService, AssetLoadMethod, AssetType, IAssetLoaderService } from '../util/assetLoaderService';
import { createLazyLoader } from './lazyLoading';
import { createRefreshListener } from './refreshAd';
import { Moli } from '../types/moli';

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

class DfpService implements Moli.MoliTag {

  /**
   * The time to wait for a GDPR response from the consent management platform.
   *
   * - Amazon A9 defaults to 50ms
   * - Prebid defaults 10.000ms
   * @type {number} milliseconds
   */
  private readonly consentManagementTimeout: number = 500;

  /**
   * creates a promise that is resolved when prebid js is loaded. we initialize this as early as possible and only
   * once to avoid race conditions in tests and unnecessary promise creations
   */
  private readonly prebidReady: Promise<prebidjs.IPrebidJs>;

  /**
   * The moli configuration. Set by the initialize method and used to configure
   * all ads on the current page.
   */
  private config?: Moli.MoliConfig;


  /**
   *
   * @param assetService - Currently needed to load amazon
   * @param cookieService - Access browser cookies
   */
  constructor(private assetService: IAssetLoaderService,
    private cookieService: ICookieService) {

    // we cannot use apstag as member like googleTag, because a9 script overwrites the window.apstag completely on script load
    this.initApstag();
    this.prebidReady = this.awaitPrebidLoaded();
  }

  /**
   * Initializes and shows ads
   *
   * @param config - the ad configuration
   * @return {Promise<void>}   a promise resolving when the first ad is shown OR a timeout occurs
   */
  public initialize = (config: Moli.MoliConfig): Promise<void> => {
    if (this.config) {
      return Promise.reject('Already initialized');
    }

    this.config = config;

    const slots = config.slots;

    const dfpReady = this.awaitGptLoaded()
      .then(() => this.awaitDomReady())
      .then(() => this.configureAdNetwork());

    // concurrently initialize lazy loaded slots
    const lazySlots: Promise<Moli.LazyAdSlot[]> = dfpReady.then(() => slots.filter(this.isLazySlot));
    this.initLazyLoadedSlots(lazySlots, config);

    // eagerly displayed slots
    const eagerlyLoadedSlots = dfpReady
      // request all existing and non-lazy loading slots
      .then(() => this.filterAvailableSlots(slots).filter(slot => !this.isLazySlot(slot)))
      // configure slots with gpt
      .then((availableSlots: Moli.AdSlot[]) => this.registerSlots(availableSlots))
      .then((registeredSlots: ISlotDefinition<Moli.AdSlot>[]) => this.displayAds(registeredSlots));

    // initialize refreshable slots
    this.initRefreshableSlots(eagerlyLoadedSlots, config);

    // We wait for a prebid response and then refresh.
    const refreshedAds: Promise<ISlotDefinition<Moli.AdSlot>[]> = eagerlyLoadedSlots
      .then(slotDefinitions => this.initHeaderBidding(slotDefinitions, config))
      .then((adSlots: ISlotDefinition<Moli.AdSlot>[]) => this.refreshAds(adSlots));

    return refreshedAds
      .then(() => { return; })
      .catch(reason => this.logger.error('DfpService :: Initialization failed' + JSON.stringify(reason)));
  }

  public getConfig = (): Moli.MoliConfig | undefined => {
    return this.config;
  }

  /**
   * Lazy loaded slots.
   *
   * A lazy loaded slot can contain any other slot. This includes prebid (header bidding) slots.
   * This method handles
   *
   * @param lazyLoadingSlots
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
              bidRequests.push(this.initPrebid([slotDefinition], config));
            }

            if (dfpSlotLazy.a9) {
              bidRequests.push(this.fetchA9Slots([dfpSlotLazy as Moli.A9AdSlot], config));
            }

            return Promise.all(bidRequests).then(() => slotDefinition);
          })
          .then(({ adSlot, dfpSlot }) => {
            window.googletag.pubads().refresh([adSlot]);
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
   */
  private initRefreshableSlots(displayedAdSlots: Promise<ISlotDefinition<Moli.AdSlot>[]>, config: Moli.MoliConfig): void {
    displayedAdSlots
      .then(registrations => registrations.filter(this.isRefreshableAdSlotDefinition))
      .then((refreshableSlots: ISlotDefinition<Moli.RefreshableAdSlot>[]) => refreshableSlots.forEach(({ adSlot, dfpSlot }) => {
        const listener = createRefreshListener(dfpSlot.trigger);

        if (listener) {
          listener.addAdRefreshListener(() => {
            const bidRequests: Promise<unknown>[] = [];

            if (dfpSlot.prebid) {
              bidRequests.push(this.initPrebid([{ adSlot, dfpSlot }], config));
            }

            if (dfpSlot.a9) {
              bidRequests.push(this.fetchA9Slots([dfpSlot as Moli.A9AdSlot], config));
            }

            Promise.all(bidRequests)
              .then(() => {
                window.googletag.pubads().refresh([adSlot]);
              });
          });
        } else {
          this.logger.error(`Invalid refreshable ad slot trigger: ${JSON.stringify(dfpSlot.trigger)}`);
        }
      }));
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

    return Promise.all([this.initA9(a9Slots, config), this.initPrebid(prebidSlots, config)])
      .then(() => availableSlots);
  }

  /**
   * Initialize the given prebid slots. The retuned promise is fulfilled when
   *
   * - prebid.js has been loaded completely
   * - all prebid slots have been registered
   * - all prebid slot have been requested
   *
   * @param {Promise<ISlotDefinition<Moli.AdSlot>[]>} dfpPrebidSlots
   * @returns {Promise<void>}
   */
  private initPrebid(dfpPrebidSlots: ISlotDefinition<Moli.AdSlot>[], config: Moli.MoliConfig): Promise<prebidjs.IBidResponsesMap> {
    return this.prebidReady
      .then((pbjs) => this.configurePrebid(pbjs, config))
      .then(() => this.registerPrebidSlots(dfpPrebidSlots))
      .then(() => this.requestPrebid(dfpPrebidSlots))
      .catch(reason => {
        this.logger.warn(reason);
        return {};
      });
  }

  private configurePrebid(pbjs: prebidjs.IPrebidJs, config: Moli.MoliConfig): Promise<void> {
    return new Promise<prebidjs.IPrebidJsConfig>((resolve, reject) => {
      config.prebid ? resolve(config.prebid.config) : reject('Configure prebid without a prebid configuration is not allowed');
    }).then(prebidConfig => pbjs.setConfig(prebidConfig));
  }

  private initA9(a9Slots: ISlotDefinition<Moli.A9AdSlot>[], config: Moli.MoliConfig): Promise<void> {
    // no a9 configured
    if (!config.a9) {
      return Promise.resolve();
    }

    // TODO make sure the a9 script is only loaded once! Probably move this somewhere earlier in the initialization
    this.loadA9Script(config); // load a9 script, but we don't have to wait until loaded

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
    window.googletag = window.googletag || {};
    window.googletag.cmd = window.googletag.cmd || [];
    return new Promise<void>(resolve => window.googletag.cmd.push(resolve));
  }

  private awaitPrebidLoaded(): Promise<prebidjs.IPrebidJs> {
    window.pbjs = window.pbjs || {};
    window.pbjs.que = window.pbjs.que || [];
    return new Promise(resolve => window.pbjs.que.push(() => resolve(window.pbjs)));
  }



  private initApstag(): void {
    if (window.apstag) {
      return;
    }
    window.apstag = {
      _Q: [],
      init: function (): void { window.apstag._Q.push(['i', arguments]); },
      fetchBids: function (): void { window.apstag._Q.push(['f', arguments]); },
      setDisplayBids: function (): void { return; },
      targetingKeys: function (): void { return; }
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
        cmpTimeout: this.consentManagementTimeout,
      },
    });

    return this.assetService.loadAsset({
      name: 'A9',
      assetType: AssetType.SCRIPT,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: config.a9.scriptUrl ? config.a9.scriptUrl : '//c.amazon-adsystem.com/aax2/apstag.js'
    });
  }

  private configureAdNetwork(): void {
    this.setupConsentFromSourcepoint();

    window.googletag.pubads().enableAsyncRendering();
    window.googletag.pubads().disableInitialLoad();
    window.googletag.pubads().enableSingleRequest();
    window.googletag.enableServices();
  }

  /**
   * If the user has opted out of personalized ads via our consent management platform (sourcepoint),
   * we configure gpt accordingly. By default gpt will serve personalized ads.
   *
   * This ensure that a user needs to opt out and we don't block any ad calls.
   */
  private setupConsentFromSourcepoint(): void {
    if (this.cookieService.exists('_sp_enable_dfp_personalized_ads') &&
      this.cookieService.get('_sp_enable_dfp_personalized_ads') === 'false'
    ) {
      window.googletag.pubads().setRequestNonPersonalizedAds(1);
    }
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
  private registerPrebidSlots(dfpPrebidSlots: ISlotDefinition<Moli.AdSlot>[]): void {
    const slots = dfpPrebidSlots.map(slot => slot.dfpSlot);
    window.pbjs.addAdUnits(slots.map((slot: Moli.AdSlot) => {
      return {
        code: slot.domId,
        // TODO make the access to the prebid object without forcing no-null check
        mediaTypes: slot.prebid!.adUnit.mediaTypes,
        bids: slot.prebid!.adUnit.bids
      };
    }));
  }

  private fetchA9Slots(slots: Moli.A9AdSlot[], config: Moli.MoliConfig): Promise<void> {
    if (config.a9 || slots.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      window.apstag.fetchBids({
        slots: slots.map(slot => {
          return {
            slotID: slot.domId,
            slotName: slot.adUnitPath,
            // FIXME configure a9 sizes
            sizes: [] // slot.prebidSizes() // banner sizes
          };
        }),
        // TODO we need to find a way to make sure that the config object is not reset after initialization
        timeout: config.a9 ? config.a9.timeout : 1000,
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
    let adSlot: googletag.IAdSlot;

    if (dfpSlot.position === 'in-page') {
      adSlot = window.googletag.defineSlot(dfpSlot.adUnitPath, dfpSlot.sizes, dfpSlot.domId);
    } else {
      adSlot = window.googletag.defineOutOfPageSlot(dfpSlot.adUnitPath, dfpSlot.domId);
    }

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

  private timeoutPromise(timeout: number): Promise<void> {
    return new Promise<void>(resolve => {
      window.setTimeout(resolve, timeout);
    });
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

  private get logger(): Moli.MoliLogger {
    return (this.config && this.config.logger) ? this.config.logger : {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
  }
}

const dfpService = new DfpService(assetLoaderService, cookieService);

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = {
  initialize: dfpService.initialize,
  getConfig: dfpService.getConfig
};
window.moli = moli;
