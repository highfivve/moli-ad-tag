import domready = require('domready');

import { apstag } from '../types/apstag';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { DfpPrebidSlot, DfpSlot, DfpSlotLazy, DfpSlotRefreshable } from './adNetworkSlot';
import { ICookieService } from '../util/cookieService';
import { AssetLoadMethod, AssetType, IAssetLoaderService } from '../util/assetLoaderService';
import { Moli } from '../types/moli';

import MoliLogger = Moli.MoliLogger;
import IApsTag = apstag.IApsTag;

/**
 * Combines the dfp slot definition along with the actual googletag.IAdSlot definition.
 */
interface ISlotDefinition<S extends DfpSlot> {
  /** The dfp slot definition */
  readonly dfpSlot: S;

  /** The actual dfp slot returned by the googletag script */
  readonly adSlot: googletag.IAdSlot;
}

declare const window: Window & apstag.IGlobalApsTagApi;

export class DfpService {

  /**
   * The time to wait for a header bidding response before we continue to render the ads.
   * @type {number} milliseconds
   */
  private readonly prebidTimeout: number = 1000;
  private readonly a9Timeout: number = 1000;

  /**
   * The time to wait for a GDPR response from the consent management platform.
   *
   * - Amazon A9 defaults to 50ms
   * - Prebid defaults 10.000ms
   * @type {number} milliseconds
   */
  private readonly consentManagementTimeout: number = 500;

  /**
   * The user sync delay for prebid.
   *
   * @type {number} milliesconds
   */
  private readonly syncDelay: number = 6000;

  /**
   * creates a promise that is resolved when prebid js is loaded. we initialize this as early as possible and only
   * once to avoid race conditions in tests and unnecessary promise creations
   */
  private readonly prebidReady: Promise<prebidjs.IPrebidJs>;


  /**
   *
   * @param googleTag - inject google tag as it's loaded by an external script tag
   * @param pbjs - inject pbjs script here for easier testing. Will be loaded by the DFP service (at least for now)
   * @param assetService - Currently needed to load amazon
   * @param cookieService - Access browser cookies
   * @param logger - for errors and warnings
   * @param apstag - amazon a9, optional, only for test purpose
   */
  constructor(private googleTag: googletag.IGoogleTag,
              private pbjs: prebidjs.IPrebidJs,
              private assetService: IAssetLoaderService,
              private cookieService: ICookieService,
              private logger: MoliLogger,
              apstag?: IApsTag) {

    // we cannot use apstag as member like googleTag, because a9 script overwrites the window.apstag completely on script load
    window.apstag = apstag || this.initApstag();
    this.prebidReady = new Promise(resolve => this.pbjs.que.push(() => resolve(this.pbjs)));
  }

  /**
   * Initializes and shows DFP ads.
   *
   * @param slots             a list of potential DFP slots.
   * @return {Promise<void>}   a promise resolving when the first ad is shown OR a timeout occurs
   */
  public initialize(slots: DfpSlot[]): Promise<unknown> {

    const dfpReady = this.awaitAdNetworkLoaded()
      .then(() => this.awaitDomReady())
      .then(() => this.configureAdNetwork());

    // concurrently initialize lazy loaded slots
    const lazySlots: Promise<DfpSlotLazy[]> = dfpReady.then(() => slots.filter(this.isLazySlot));
    this.initLazyLoadedSlots(lazySlots);

    // eagerly displayed slots
    const eagerlyLoadedSlots = dfpReady
      // request all existing and non-lazy loading slots
      .then(() => this.filterAvailableSlots(slots).filter(slot => !this.isLazySlot(slot)))
      // configure slots with gpt
      .then((availableSlots: DfpSlot[]) => this.registerSlots(availableSlots))
      .then((registeredSlots: ISlotDefinition<DfpSlot>[]) => this.displayAds(registeredSlots));

    // initialize refreshable slots
    this.initRefreshableSlots(eagerlyLoadedSlots);

    // We wait for a prebid response and then refresh.
    const refreshedAds: Promise<ISlotDefinition<DfpSlot>[]> = eagerlyLoadedSlots
        .then(slotDefinitions => this.initHeaderBidding(slotDefinitions))
        .then((adSlots: ISlotDefinition<DfpSlot>[]) => this.refreshAds(adSlots));

    // handle wallpaper ads
    const adsPromise = refreshedAds
      .catch(reason => this.logger.error('DfpService :: Initialization failed' + JSON.stringify(reason)));

    const timeoutPromise = this.awaitDomReady()
      .then(() => this.timeoutPromise(2000));

    // we grant our ads a total of 2 seconds to load before we display the answers anyway. otherwise users on slow
    // connections would be stuck waiting for answers for a long time.
    return Promise.race([adsPromise, timeoutPromise]);
  }

  /**
   * Lazy loaded slots.
   *
   * A lazy loaded slot can contain any other slot. This includes prebid (header bidding) slots.
   * This method handles
   *
   * @param lazyLoadingSlots
   */
  private initLazyLoadedSlots(lazyLoadingSlots: Promise<DfpSlotLazy[]>): void {
    lazyLoadingSlots
      .then((lazySlots: DfpSlotLazy[]) => lazySlots.forEach((dfpSlotLazy) => {

        dfpSlotLazy.onRefresh()
          .then(() => {
            if (document.getElementById(dfpSlotLazy.domId)) {
              return Promise.resolve();
            }
            return Promise.reject(`DfpService: lazy slot dom element not available: ${dfpSlotLazy.adUnitPath} / ${dfpSlotLazy.domId}`);
          })
          .then(() => this.registerSlot(dfpSlotLazy))
          .then(adSlot => {
            const slotDefinition: ISlotDefinition<DfpSlot> = {adSlot, dfpSlot: dfpSlotLazy};
            // check if the lazy slot wraps a prebid slot and request prebid too
            // only executes the necessary parts of `this.initHeaderBidding`
            if (dfpSlotLazy instanceof DfpPrebidSlot) {
              const prebid = this.initPrebid([{adSlot, dfpSlot: dfpSlotLazy}]);
              const a9 = this.fetchA9Slots([dfpSlotLazy]);
              return Promise.all([prebid, a9]).then(() => slotDefinition);
            }
            return Promise.resolve(slotDefinition);
          })
          .then(({ adSlot, dfpSlot }) => {
            this.googleTag.pubads().refresh([adSlot]);
            this.showAdSlot(dfpSlot);
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
   * @param {Promise<ISlotDefinition<DfpSlot>[]>} displayedAdSlots
   */
  // TODO: is this still correct compared to the old implementation? slots are not wrapped anymore
  private initRefreshableSlots(displayedAdSlots: Promise<ISlotDefinition<DfpSlot>[]>): void {
    displayedAdSlots
      .then(registrations => registrations.filter(reg => reg.dfpSlot instanceof DfpSlotRefreshable))
      .then((refreshableSlots: ISlotDefinition<DfpSlot>[]) => refreshableSlots.forEach(({adSlot, dfpSlot}) => {
        // cast dfpSlot to DfpSlotRefreshable as we know this must be a refreshable slot
        const refreshableDfpSlot = dfpSlot as DfpSlotRefreshable;
          refreshableDfpSlot.setRefeshListener(() => {
          const requestHeaderBids: Promise<any> = refreshableDfpSlot instanceof DfpPrebidSlot ?
            Promise.all([
              this.initPrebid([{adSlot, dfpSlot: refreshableDfpSlot}]),
              this.fetchA9Slots([refreshableDfpSlot])]
            ) : Promise.resolve();

            requestHeaderBids.then(() => {
              this.googleTag.pubads().refresh([adSlot]);
              this.showAdSlot(dfpSlot);
            });
        });
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
  private initHeaderBidding(availableSlots: ISlotDefinition<DfpSlot>[]): Promise<ISlotDefinition<DfpSlot>[]> {
    this.logger.debug('DFP activate header bidding');

    // https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
    const notEmpty = <T>(value: T | null): value is T => {
      return value !== null;
    };

    const dfpPrebidSlots: ISlotDefinition<DfpPrebidSlot>[] = availableSlots
      .map(({adSlot, dfpSlot}) => {
        // TODO: is this correct compared to the previous implementation?
          if (dfpSlot instanceof  DfpPrebidSlot || dfpSlot instanceof DfpPrebidSlot) {
            return {adSlot, dfpSlot: dfpSlot};
          }
          return null;
      })
      .filter(notEmpty)
    ;

    return Promise.all([this.initA9(dfpPrebidSlots), this.initPrebid(dfpPrebidSlots)])
      .then(() => availableSlots);
  }

  /**
   * Initialize the given prebid slots. The retuned promise is fulfilled when
   *
   * - prebid.js has been loaded completely
   * - all prebid slots have been registered
   * - all prebid slot have been requested
   *
   * @param {Promise<ISlotDefinition<DfpPrebidSlot>[]>} dfpPrebidSlots
   * @returns {Promise<void>}
   */
  private initPrebid(dfpPrebidSlots: ISlotDefinition<DfpPrebidSlot>[]): Promise<prebidjs.IBidResponsesMap> {
    return this.prebidReady
      .then((pbjs) => this.configurePrebid(pbjs))
      .then(() => this.registerPrebidSlots(dfpPrebidSlots))
      .then(() => this.requestPrebid(dfpPrebidSlots))
      .catch(reason => {
        this.logger.warn(reason);
        return {};
      });
  }

  private configurePrebid(pbjs: prebidjs.IPrebidJs): Promise<void> {
    return new Promise<void>(resolve => {
      pbjs.setConfig({
        bidderTimeout: this.prebidTimeout,
        consentManagement: {
          timeout: this.consentManagementTimeout,
          allowAuctionWithoutConsent: true
        },
        userSync: {
          syncDelay: this.syncDelay,
          filterSettings: {
            // pubmatic wants to sync via an iframe, because they aren't able to put the relevant information into a single image call -.-
            iframe: {
              bidders: [prebidjs.PubMatic, prebidjs.OpenX, prebidjs.SmartAdServer],
              filter: 'include'
            },
            // by default, prebid enables the image sync for all SSPs. We make it explicit here.
            image: {
              bidders: ['*'],
              filter: 'include'
            }
          }
        },
        currency: {
          adServerCurrency: 'EUR',
          granularityMultiplier: 1,
          // taken from: https://currency.prebid.org/latest.json
          defaultRates: {
            'USD': {
              'EUR': 0.8695652174
            }
          }
        }
      });
      resolve();
    });
  }

  private initA9(dfpPrebidSlots: ISlotDefinition<DfpPrebidSlot>[]): Promise<void> {
    this.loadA9Script(); // load a9 script, but we don't have to wait until loaded

    return Promise.resolve(dfpPrebidSlots)
      .then((slots:  ISlotDefinition<DfpPrebidSlot>[]) => slots.map(slot => slot.dfpSlot))
      .then((slots: DfpPrebidSlot[]) => this.fetchA9Slots(slots))
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
  private awaitAdNetworkLoaded(): Promise<void> {
    return new Promise<void>(resolve => this.googleTag.cmd.push(resolve));
  }

  private initApstag(): IApsTag {
    const apstag: IApsTag = {
      _Q: [],
      init: function(): void { apstag._Q.push(['i', arguments]); },
      fetchBids: function(): void { apstag._Q.push(['f', arguments]); },
      setDisplayBids: function(): void { return; },
      targetingKeys: function(): void { return; }
    };

    return apstag;
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
  private loadA9Script(): Promise<void> {

    window.apstag.init({
      pubID: '3569',
      adServer: 'googletag',
      gdpr: {
        cmpTimeout: this.consentManagementTimeout,
      },
    });

    return this.assetService.loadAsset({
      name: 'A9',
      assetType: AssetType.SCRIPT,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: `//c.amazon-adsystem.com/aax2/apstag.js`
    });
  }

  private configureAdNetwork(): void {
    this.setupConsentFromSourcepoint();

    this.googleTag.pubads().enableAsyncRendering();
    this.googleTag.pubads().disableInitialLoad();
    this.googleTag.pubads().enableSingleRequest();
    this.googleTag.enableServices();
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
      this.googleTag.pubads().setRequestNonPersonalizedAds(1);
    }
  }

  private filterAvailableSlots(slots: DfpSlot[]): DfpSlot[] {
    return slots.filter((slot: DfpSlot) => !!document.getElementById(slot.domId));
  }

  /**
   * Register prebid slots with pbjs.
   *
   * @param dfpPrebidSlots that should be registered
   * @returns the unaltered prebid slots
   */
  private registerPrebidSlots(dfpPrebidSlots:  ISlotDefinition<DfpPrebidSlot>[]): void {
    const slots = dfpPrebidSlots.map(slot => slot.dfpSlot);
    this.pbjs.addAdUnits(slots.map((slot: DfpPrebidSlot) => {
      return {
        code: slot.domId,
        mediaTypes: slot.mediaTypes,
        bids: slot.bids
      };
    }));
  }

  private fetchA9Slots(slots: DfpPrebidSlot[]): Promise<void> {

    return new Promise<void>(resolve => {
      window.apstag.fetchBids({
        slots: slots.map(slot => {
          return {
            slotID: slot.domId,
            slotName: slot.adUnitPath,
            sizes: slot.prebidSizes() // banner sizes
          };
        }),
        timeout: this.a9Timeout,
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
  private requestPrebid(slotDefinitions: ISlotDefinition<DfpPrebidSlot>[]): Promise<prebidjs.IBidResponsesMap> {
    return new Promise<prebidjs.IBidResponsesMap>(resolve => {
      // It seems that the bidBackHandler can be triggered more than once. The reason might be that
      // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
      // afterwards anyway the bidsBackHandler is called a second time.
      let adserverRequestSent = false;

      const dfpSlots = slotDefinitions.map(slot => slot.dfpSlot);
      const adUnitCodes = dfpSlots.map(slot => slot.domId);

      this.pbjs.requestBids({
        timeout: this.prebidTimeout,
        adUnitCodes: adUnitCodes,
        bidsBackHandler: (bidResponses: prebidjs.IBidResponsesMap, _timedOut: boolean) => {
          // the bids back handler seems to run on a different thread
          // in consequence, we need to catch errors here to propagate them to top levels
          try {
            if (adserverRequestSent) {
              return;
            }

            if (this.checkForJustPremiumWallpaper(bidResponses)) {
              this.destroySkyscraperAdUnit(slotDefinitions);
            }

            adserverRequestSent = true;

            // set key-values for DFP to target the correct line items
            this.pbjs.setTargetingForGPTAsync(adUnitCodes);

            resolve(bidResponses);
          } catch (error) {
            this.logger.error('DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error));
            resolve({});
          }
        }
      });
    });

  }

  /**
   * Checks if bid responses contain a JustPremium bid that has the wallpaper format
   */
  private checkForJustPremiumWallpaper(bidResponses: prebidjs.IBidResponsesMap): boolean {
    const adPresenterDesktop = bidResponses['ad-presenter-desktop'];
    const justPremiumWallpaperBid = adPresenterDesktop ?
      adPresenterDesktop.bids.filter( (presenterBid: prebidjs.IJustPremiumBidResponse) =>
        presenterBid.bidder === prebidjs.JustPremium && presenterBid.format === prebidjs.JustPremiumWallpaper && presenterBid.cpm > 0
      ) : [];
    return justPremiumWallpaperBid.length !== 0;
  }

  /**
   * Destroys the Skyscraper Ad Unit.
   * In case of Wallpaper being served from DFP, we don't want the skyscraper Ad Unit to be served as well.
   */
  private destroySkyscraperAdUnit(slotDefinitions: ISlotDefinition<DfpPrebidSlot>[]): void {
    const skyscraperAdSlot = slotDefinitions.map(slot => slot.adSlot)
      .filter((slot: googletag.IAdSlot) => slot.getSlotElementId() === 'ad-sidebar-skyScraper');
    this.googleTag.destroySlots(skyscraperAdSlot);
  }


  private registerSlots(slots: DfpSlot[]): ISlotDefinition<DfpSlot>[] {
    if (slots.length === 0) {
      // todo : tracking if answer displayed but no ad slot created - GF-6632
      this.logger.debug('No DFP ads displayed!');
    }

    return slots.map((slot: DfpSlot) => {
      return {dfpSlot: slot, adSlot: this.registerSlot(slot)};
    });
  }

  private registerSlot(dfpSlot: DfpSlot): googletag.IAdSlot {
    let adSlot: googletag.IAdSlot;

    if (dfpSlot.position === 'in-page') {
      adSlot = this.googleTag.defineSlot(dfpSlot.adUnitPath, dfpSlot.sizes, dfpSlot.domId);
    } else {
      adSlot = this.googleTag.defineOutOfPageSlot(dfpSlot.adUnitPath, dfpSlot.domId);
    }

    adSlot.setCollapseEmptyDiv(true);
    adSlot.addService(this.googleTag.pubads());
    return adSlot;
  }

  private displayAds(slots: ISlotDefinition<DfpSlot>[]): ISlotDefinition<DfpSlot>[] {
    slots.forEach((definition: ISlotDefinition<DfpSlot>) =>  this.displayAd(definition.dfpSlot));
    return slots;
  }

  private displayAd(dfpSlot: DfpSlot): void {
    this.logger.debug('Displaying' + dfpSlot.domId);
    this.googleTag.display(dfpSlot.domId);
  }

  /**
   * Refresh all the passed slots
   * @param slots - the slots that should be refreshed
   * @returns {ISlotDefinition[]} unaltered
   */
  private refreshAds(slots: ISlotDefinition<DfpSlot>[]): ISlotDefinition<DfpSlot>[] {
    this.googleTag.pubads().refresh(slots.map(slot => slot.adSlot));
    return slots;
  }

  private showAdSlot(dfpSlot: DfpSlot): void {
    const slotElement = document.querySelector(`#${dfpSlot.domId}`);
    this.googleTag.pubads().addEventListener('slotRenderEnded', (event: googletag.events.ISlotRenderEndedEvent) => {
      if (!event.isEmpty && slotElement) {
        slotElement.classList.remove('u-hidden');
      }
    });
  }

  private timeoutPromise(timeout: number): Promise<void> {
    return new Promise<void>(resolve => {
      window.setTimeout(resolve, timeout);
    });
  }

  private isLazySlot(slot: DfpSlot): slot is DfpSlotLazy {
    return slot instanceof DfpSlotLazy;
  }
}
