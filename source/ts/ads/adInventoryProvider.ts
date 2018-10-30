import { gfUserAgent } from '../../../context/UserAgent';
import { gfContext } from '../../../context/GfContext';
import { ILogger } from '../../../utils/logger';
import { parseQueryString } from '../../../utils/query';
import { QueryParameters } from '../../../utils/query-parameters';

import { prebidjs } from '../types/prebidjs';

import { IAdNetworkConfiguration } from './IAdNetworkService';
import {
  DfpHeaderAreaSlot, DfpListingFluidPositionSlot, DfpPrebidSlot, DfpPresenterMobileSlot,
  DfpQdpOutOfPageFloorSlotDesktop, DfpQdpOutOfPageMobileInterstitialSlot, DfpQdpOutOfPagePopUnderSlotDesktop,
  DfpQDPPositionSlot, DfpQDPRelatedContentPositionSlot, DfpSidebarSlot1, DfpSidebarSlot2, DfpSidebarSlot3,
  DfpSkyScraperSlot, DfpSlot, DfpSlotLazy, DfpSlotRefreshable, DfpSlotSize, DfpWallpaperPixelSlot,
  RelatedQuestionsTopSlot, StickySlot
} from './adNetworkSlot';
import {
  criteoPrebidConfigHeaderAreaDesktop, criteoPrebidConfigPos1Mobile, criteoPrebidConfigPos2Mobile,
  criteoPrebidConfigPresenterMobile, criteoPrebidConfigSidebar1Desktop, criteoPrebidConfigSidebar2Desktop,
  criteoPrebidConfigSidebar3Desktop, criteoPrebidConfigSkyscraperDesktop, criteoPrebidConfigStickyAd
} from './prebid/criteo';
import {
  appNexusPrebidConfigHeaderAreaDesktop, appNexusPrebidConfigPos1Mobile, appNexusPrebidConfigPos2VideoDesktop,
  appNexusPrebidConfigPos2VideoMobile, appNexusPrebidConfigPresenterMobile,
  appNexusPrebidConfigRelatedContentStream1Mobile, appNexusPrebidConfigRelatedContentStream2Mobile,
  appNexusPrebidConfigRelatedContentStream3Mobile, appNexusPrebidConfigSidebar1Desktop,
  appNexusPrebidConfigSidebar2Desktop, appNexusPrebidConfigSidebar3Desktop, appNexusPrebidConfigSkyscraperDesktop,
  appNexusPrebidConfigStickyAd
} from './prebid/appNexus';
import * as LazyLoading from './lazyLoading';
import * as AdRefreshListener from './refreshAd';
import {
  improveDigitalPrebidConfigHeaderAreaDesktop, improveDigitalPrebidConfigPos1Mobile,
  improveDigitalPrebidConfigPos2Mobile, improveDigitalPrebidConfigPresenterMobile,
  improveDigitalPrebidConfigRelatedContentStream1Mobile, improveDigitalPrebidConfigRelatedContentStream2Mobile,
  improveDigitalPrebidConfigRelatedContentStream3Mobile, improveDigitalPrebidConfigSidebar1Desktop,
  improveDigitalPrebidConfigSidebar2Desktop, improveDigitalPrebidConfigSidebar3Desktop,
  improveDigitalPrebidConfigSkyscraperDesktop, improveDigitalPrebidConfigStickyAd,
} from './prebid/improveDigital';
import {
  indexExchangePrebidConfigHeaderAreaDesktop, indexExchangePrebidConfigPos1Mobile, indexExchangePrebidConfigPos2Mobile,
  indexExchangePrebidConfigPresenterMobile, indexExchangePrebidConfigRelatedContentStream1Mobile,
  indexExchangePrebidConfigRelatedContentStream2Mobile, indexExchangePrebidConfigRelatedContentStream3Mobile,
  indexExchangePrebidConfigSidebar1Desktop, indexExchangePrebidConfigSidebar2Desktop,
  indexExchangePrebidConfigSidebar3Desktop, indexExchangePrebidConfigSkyscraperDesktop,
  indexExchangePrebidConfigStickyAd,
} from './prebid/indexExchange';

import {
  pubMaticPrebidConfigHeaderArea, pubMaticPrebidConfigPos1Mobile, pubMaticPrebidConfigPos2Mobile,
  pubMaticPrebidConfigRelatedContentStream1Mobile, pubMaticPrebidConfigRelatedContentStream2Mobile,
  pubMaticPrebidConfigRelatedContentStream3Mobile, pubMaticPrebidConfigSidebar1Desktop,
  pubMaticPrebidConfigSidebar2Desktop, pubMaticPrebidConfigSidebar3Desktop, pubMaticPrebidConfigSkyscraperDesktop
} from './prebid/pubmatic';
import {
  nanoInteractivePrebidConfigHeaderAreaDesktop, nanoInteractivePrebidConfigPos1Mobile,
  nanoInteractivePrebidConfigPresenterMobile, nanoInteractivePrebidConfigSidebar2Desktop,
  nanoInteractivePrebidConfigSkyscraperDesktop, nanoInteractivePrebidConfigStickyAd
} from './prebid/nanoInteractive';
import {
  openxPrebidConfigHeaderAreaDesktop, openxPrebidConfigPos1Mobile, openxPrebidConfigPos2Mobile,
  openxPrebidConfigPresenterMobile, openxPrebidConfigRelatedContentStream1Mobile,
  openxPrebidConfigRelatedContentStream2Mobile, openxPrebidConfigRelatedContentStream3Mobile,
  openxPrebidConfigSidebar1Desktop, openxPrebidConfigSidebar2Desktop, openxPrebidConfigSidebar3Desktop,
  openxPrebidConfigSkyscraperDesktop, openxPrebidConfigStickyAd
} from './prebid/openx';
import {
  smartPrebidConfigHeaderAreaDesktop, smartPrebidConfigPos1Mobile, smartPrebidConfigPos2Mobile,
  smartPrebidConfigPos2VideoDesktop, smartPrebidConfigPresenterMobile, smartPrebidConfigRelatedContentStream1Mobile,
  smartPrebidConfigRelatedContentStream2Mobile, smartPrebidConfigRelatedContentStream3Mobile,
  smartPrebidConfigSidebar1Desktop, smartPrebidConfigSidebar2Desktop, smartPrebidConfigSidebar3Desktop,
  smartPrebidConfigSkyscraperDesktop, smartPrebidConfigStickyAd
} from './prebid/smart';
import { justPremiumPrebidConfigMobileScroller, justPremiumPrebidConfigWallpaper } from './prebid/justpremium';
import { unrulyPrebidConfigPos2VideoDesktop, unrulyPrebidConfigPos2VideoMobile } from './prebid/unruly';
import { teadsPrebidConfigPos2VideoDesktop, teadsPrebidConfigPos2VideoMobile } from './prebid/teads';

export class AdInventoryProvider {

  /**
   * The ad slots this inventory provider offers.
   * Slots are initialized in the `adSlotInventory` getter.
   */
  private slots: DfpSlot[] | undefined;

  constructor(private readonly _adConfiguration: IAdNetworkConfiguration, private logger: ILogger) {
  }

  /**
   * Returns the ad configuration for this page.
   *
   * @returns {IAdNetworkConfiguration}
   */
  get adConfiguration(): IAdNetworkConfiguration {
    return {
      tags: this._adConfiguration.tags,
      consultation: this._adConfiguration.consultation,
      isAdultContent: this._adConfiguration.isAdultContent,
      marketingChannel: this._adConfiguration.marketingChannel,
      abTest: this.getVariation(window.location.search, this._adConfiguration.abTest)
    };
  }

  /**
   * Returns all ad slots of all ad networks. This method lazily initializes
   * all slots, because the lazy and refreshable ad slots perform side effects (registering event
   * listeners of some kind).
   *
   * @return {IAdNetworkSlot[]}
   */
  get adSlotInventory(): DfpSlot[] {
    if (this.slots) {
      return this.slots;
    }
    this.slots = this.dfpSlots();
    return this.slots;
  }

  /**
   * Maps a passback adunit path to the original adSlot.
   *
   * == Explanation ==
   *
   * Passbacks are necessary for high-priced ads that have a low fill-rate, but a high CPM.
   * For gutefrage this is the case for all video advertisers like Spotx, Teads, or Smartclip.
   *
   * In order to improve fill rates we use video advertisers as passbacks as well, which creates
   * a passback chain. Example:
   *
   * Spotx -> Smartstream -> AdSense
   *
   * The video ad passbacks communicate via the iAdFrameProtocol to resize (for a successfull AdSense passback)
   * or collapse (after a successful video ad) the AdSlot. The iFrameAdProtocolMessengerListener uses the
   * adInventory to find  the corresponding DOM element für an adunit path. This works for passback changes with
   * a single passback (e.g. Spotx -> AdSense), but fails for passback chains (Spotx -> Smartstream -> AdSense)
   * as the adunit path changes.
   *
   * Example: Spotx -> Smartstream -> AdSense
   * 1. The spotx passback code receives the original adunit path (e.g. /33559401/gf/fragen/pos2)
   * 2. The spotx passback code executes the dfp passback code and requests an ad for `/33559401/gf/fragen/Passback_Spotx`
   * 3. Smartclip delievers on this passback. At this point we have lost the original adunit path (`../fragen/pos2`)
   *
   * This method recovers this information by mapping the passback adunits to the original adunit path.
   *
   *
   * @param {String} adunit
   * @returns {DfpSlot | undefined}
   */
  adSlotForPassback(adunit: String): DfpSlot | undefined {
    switch (adunit) {
      case '/33559401/gf/fragen/Passback_Spotx':
      case '/33559401/gf/fragen/Passback_Smartclip':
      case '/33559401/gf/fragen/Passback_Teads':

        return this.adSlotInventory.find(slot => slot.adUnitPath === '/33559401/gf/fragen/pos2');
      default:
        return undefined;
    }
  }

  /**
   * only public to be able to mock this in tests
   * @returns {boolean} true if the  current page is the qdp
   */
  isQdp(): boolean {
    return window.location.pathname.startsWith('/frage/');
  }

  /**
   * Generate the variation that should be used in the DFP ABtest targeting key-value pair.
   * Can be overridden with the `testVariation=` query parameter.
   *
   * @param search the url search string
   * @param abTest the abTest variation generated in the backend
   * @return a number between 1 to 100
   */
  private getVariation(search: string, abTest: number): number {
    const params = parseQueryString(search);
    const param = params.get(QueryParameters.abTestVariation);
    return param ? Number(param) : abTest;
  }

  /**
   * Generates a list of fitting dfp slots based on the client screen width.
   *
   * The bigger the screen the more format size are being requested. This differs
   * from the old gutefrage ad slot configuration.
   *
   * @return {[DfpSlot]} a list of suitable dfp slots
   */
  private dfpSlots(): DfpSlot[] {
    return [
      ...this.allPagesDesktopAdSlots(),
      ...this.allPagesMobileAdSlots(),
      ...this.questionDetailAdSlots(),
      ...this.listingPagesAdSlots()
    ];
  }

  /**
   * Get DFP slots on question detail pages.
   *
   * Question detail pages feature adslots between answers, plus a few extra slots.  Unlike other Dfp slots we
   * specifically compute their sizes from the actual size of the question element to make sure that the ads always
   * fit the surrounding content.
   */
  private questionDetailAdSlots(): DfpSlot[] {
    // we can't insert a QDP check here, because the location check doesn't work with handlebars

    const sizes = this.computeQuestionDetailAdSlotSizes();
    const allDeviceAdSlots = [
      // special slot for questions with no answer
      new DfpQDPPositionSlot('ad-no-answers', 'POS1a', sizes)
    ];

    if (gfUserAgent.isMobile()) {
      return [
        ...allDeviceAdSlots,
        ...this.mobileAnswerStreamAdSlots(sizes),
        ...this.nativeAdSlots(),
        // related content
        new DfpPrebidSlot(
          new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-1', 'RelatedContentStream', sizes),
          [
            appNexusPrebidConfigRelatedContentStream1Mobile,
            improveDigitalPrebidConfigRelatedContentStream1Mobile(this.adConfiguration.marketingChannel.channel),
            ...indexExchangePrebidConfigRelatedContentStream1Mobile,
            pubMaticPrebidConfigRelatedContentStream1Mobile,
            openxPrebidConfigRelatedContentStream1Mobile,
            smartPrebidConfigRelatedContentStream1Mobile
          ],
          this.prebidBanner(sizes)
        ),
        new DfpPrebidSlot(
          new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-2', 'RelatedContentStream2', sizes),
          [
            appNexusPrebidConfigRelatedContentStream2Mobile,
            improveDigitalPrebidConfigRelatedContentStream2Mobile(this.adConfiguration.marketingChannel.channel),
            ...indexExchangePrebidConfigRelatedContentStream2Mobile,
            pubMaticPrebidConfigRelatedContentStream2Mobile,
            openxPrebidConfigRelatedContentStream2Mobile,
            smartPrebidConfigRelatedContentStream2Mobile
          ],
          this.prebidBanner(sizes)
        ),
        new DfpPrebidSlot(
          new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-3', 'RelatedContentStream3', sizes),
          [
            appNexusPrebidConfigRelatedContentStream3Mobile,
            improveDigitalPrebidConfigRelatedContentStream3Mobile(this.adConfiguration.marketingChannel.channel),
            ...indexExchangePrebidConfigRelatedContentStream3Mobile,
            pubMaticPrebidConfigRelatedContentStream3Mobile,
            openxPrebidConfigRelatedContentStream3Mobile,
            smartPrebidConfigRelatedContentStream3Mobile
          ],
          this.prebidBanner(sizes)
        )
      ];
    } else {
      return [
        ...allDeviceAdSlots,
        this.pos2VideoDesktop(sizes),
        ...this.nativeAdSlots(),
        // related content stream
        new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-1', 'RelatedContentStream', sizes),
        new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-2', 'RelatedContentStream2', sizes),
        new DfpQDPRelatedContentPositionSlot('ad-related-content-stream-3', 'RelatedContentStream3', sizes)
      ];
    }
  }

  private nativeAdSlots(): DfpSlot[] {
    return [new RelatedQuestionsTopSlot('related-questions-top')];
  }

  /**
   * Creates the mobile answerstream ad slots.
   *
   * @param sizes suitable sizes for ad slots in the answer stream
   * @returns {DfpSlot[]}
   */
  private mobileAnswerStreamAdSlots(sizes: DfpSlotSize[]): DfpSlot[] {
    return [
      // TODO make this refreshable as well
      new DfpPrebidSlot(
        new DfpQDPPositionSlot('ad-answerstream-1', 'pos1', sizes),
        [
          appNexusPrebidConfigPos1Mobile,
          ...criteoPrebidConfigPos1Mobile,
          improveDigitalPrebidConfigPos1Mobile(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigPos1Mobile,
          pubMaticPrebidConfigPos1Mobile,
          nanoInteractivePrebidConfigPos1Mobile(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
          openxPrebidConfigPos1Mobile,
          smartPrebidConfigPos1Mobile
        ],
        this.prebidBanner(sizes)
      ),
      // make pos2 slot (video) refreshable, when new answer sorting is selected
      // only in new qdp design
      this.pos2VideoMobile(sizes)
    ];
  }

  private allPagesDesktopAdSlots(): DfpSlot[] {

    const sidebar1sizes: DfpSlotSize[] = ['fluid', [300, 250], [120, 600], [160, 600], [200, 600], [300, 600]];
    const sidebar2sizes: DfpSlotSize[] = ['fluid', [300, 250]];

    if (!gfUserAgent.isDesktop()) {
      return [];
    }
    return [
      // PopUnder - second view only and once per day
      new DfpQdpOutOfPagePopUnderSlotDesktop('out-of-page-ad'),
      // FloorAd
      new DfpQdpOutOfPageFloorSlotDesktop('out-of-page-floor-ad'),
      // wallpaper coordination and configuration ad slot
      new DfpWallpaperPixelSlot('ad-wallpaper-pixel'),
      // sidebar_1 - also available on listings
      new DfpPrebidSlot(
        new DfpSidebarSlot1('ad-sidebar-1', sidebar1sizes), [
          appNexusPrebidConfigSidebar1Desktop,
          improveDigitalPrebidConfigSidebar1Desktop(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigSidebar1Desktop,
          ...criteoPrebidConfigSidebar1Desktop(sidebar1sizes),
          ...pubMaticPrebidConfigSidebar1Desktop(sidebar1sizes),
          openxPrebidConfigSidebar1Desktop,
          smartPrebidConfigSidebar1Desktop
        ],
        this.prebidBanner(sidebar1sizes)
      ),
      new DfpSlotLazy(
        new DfpPrebidSlot(
          new DfpSidebarSlot2('ad-sidebar-2', sidebar2sizes),
          [
            appNexusPrebidConfigSidebar2Desktop,
            improveDigitalPrebidConfigSidebar2Desktop(this.adConfiguration.marketingChannel.channel),
            ...indexExchangePrebidConfigSidebar2Desktop,
            ...criteoPrebidConfigSidebar2Desktop(sidebar2sizes),
            pubMaticPrebidConfigSidebar2Desktop,
            nanoInteractivePrebidConfigSidebar2Desktop(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
            openxPrebidConfigSidebar2Desktop,
            smartPrebidConfigSidebar2Desktop
          ],
          this.prebidBanner(sidebar2sizes)
        ),
        LazyLoading.QdpSidebar2Loaded()
      ),
      ...this.sidebar3Desktop(),
      // add additional desktop slots if possible
      ...this.computeHeaderAreaSlots(),
      ...this.computeSkyScraperSlot()
    ];

  }

  private allPagesMobileAdSlots(): DfpSlot[] {
    if (!gfUserAgent.isMobile()) {
      return [];
    }
    // top presenter ad
    const mobilePresenterSizes = this.computePresenterSlotSizes();
    const prebidPresenterConfig = [
      appNexusPrebidConfigPresenterMobile,
      improveDigitalPrebidConfigPresenterMobile(this.adConfiguration.marketingChannel.channel, mobilePresenterSizes),
      ...indexExchangePrebidConfigPresenterMobile,
      ...criteoPrebidConfigPresenterMobile(mobilePresenterSizes),
      nanoInteractivePrebidConfigPresenterMobile(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
      openxPrebidConfigPresenterMobile,
      smartPrebidConfigPresenterMobile
    ];

    return [
      // sticky ad
      new DfpPrebidSlot(
        new StickySlot('anchor-ad', ['fluid', [320, 50], [300, 50]]),
        [appNexusPrebidConfigStickyAd,
          ...criteoPrebidConfigStickyAd,
          improveDigitalPrebidConfigStickyAd(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigStickyAd,
          nanoInteractivePrebidConfigStickyAd(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
          openxPrebidConfigStickyAd,
          smartPrebidConfigStickyAd
        ],
        this.prebidBanner([[320, 50], [300, 50]])
      ),
      // presenter ad - right under the navigation bar
      new DfpPrebidSlot(
        new DfpPresenterMobileSlot(
          'ad-presenter-mobile',
          mobilePresenterSizes,
        ),
        prebidPresenterConfig,
        this.prebidBanner(mobilePresenterSizes)
      ),
      // interstitial | out-of-page slot
      new DfpQdpOutOfPageMobileInterstitialSlot('out-of-page-ad')
    ];
  }

  /**
   * make pos2 slot (video) refreshable, when new answer sorting is selected
   * only in new qdp design
   * @param sizes the available ad slot sizes based on the question plate
   */
  private pos2VideoDesktop(sizes: DfpSlotSize[]): DfpSlot {
    const pos2PrebidBids: prebidjs.IBid[] = [
      appNexusPrebidConfigPos2VideoDesktop,
      smartPrebidConfigPos2VideoDesktop,
      ...(gfContext.isFeatureSwitchEnabled('GD-987-Unruly-Prebid') ? [unrulyPrebidConfigPos2VideoDesktop] : []),
      ...(gfContext.isFeatureSwitchEnabled('GD-998-Teads-Prebid') ? [teadsPrebidConfigPos2VideoDesktop] : [])
    ];

    return new DfpSlotRefreshable(
      new DfpPrebidSlot(
        new DfpQDPPositionSlot('ad-answerstream-2', 'pos2', sizes),
        pos2PrebidBids,
        {
          video: {
            context: 'outstream',
            playerSize: [605, 340]
          }
        }
      ),
      new AdRefreshListener.AnswerSortingChanged()
    );
  }

  /**
   * make pos2 slot (video) refreshable, when new answer sorting is selected
   * only in new qdp design
   * @param sizes the available ad slot sizes based on the question plate
   */
  private pos2VideoMobile(sizes: DfpSlotSize[]): DfpSlot {
    const pos2PrebidBids: prebidjs.IBid[] = [
      justPremiumPrebidConfigMobileScroller,
      appNexusPrebidConfigPos2VideoMobile,
      smartPrebidConfigPos2Mobile,
      improveDigitalPrebidConfigPos2Mobile(this.adConfiguration.marketingChannel.channel),
      ...indexExchangePrebidConfigPos2Mobile,
      ...criteoPrebidConfigPos2Mobile,
      ...pubMaticPrebidConfigPos2Mobile,
      openxPrebidConfigPos2Mobile,
      ...(gfContext.isFeatureSwitchEnabled('GD-987-Unruly-Prebid') ? [unrulyPrebidConfigPos2VideoMobile] : []),
      ...(gfContext.isFeatureSwitchEnabled('GD-998-Teads-Prebid') ? [teadsPrebidConfigPos2VideoMobile] : [])
    ];

    return new DfpSlotRefreshable(
      new DfpPrebidSlot(
        new DfpQDPPositionSlot('ad-answerstream-2', 'pos2', sizes),
        pos2PrebidBids,
        {
          banner: {
            sizes: [...this.filterPrebidSizes(sizes)]
          },
          video: {
            context: 'outstream',
            playerSize: [300, 169]
          }
        }
      ),
      new AdRefreshListener.AnswerSortingChanged()
    );
  }

  /**
   * Returns a sidebar3 slot for 50% of users.
   * The other 50% will see the related-content leaderboard.
   * @returns {DfpSlot[]}
   */
  private sidebar3Desktop(): DfpSlot[] {

    const sizes: DfpSlotSize[] = ['fluid', [300, 250], [120, 600], [160, 600], [200, 600], [300, 600]];

    return [
      new DfpPrebidSlot(
        new DfpSidebarSlot3('ad-sidebar-3', sizes),
        [
          appNexusPrebidConfigSidebar3Desktop,
          improveDigitalPrebidConfigSidebar3Desktop(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigSidebar3Desktop,
          ...criteoPrebidConfigSidebar3Desktop(sizes),
          ...pubMaticPrebidConfigSidebar3Desktop(sizes),
          openxPrebidConfigSidebar3Desktop,
          smartPrebidConfigSidebar3Desktop
        ],
        this.prebidBanner(sizes)
      )
    ];
  }

  private computePresenterSlotSizes(): DfpSlotSize[] {
    const baseSizes: DfpSlotSize[] = ['fluid', [300, 50], [300, 75], [300, 100], [320, 50], [320, 75], [320, 100]];
    if (window.matchMedia('only screen and (min-width: 728px)').matches) {
      return [...baseSizes, [468, 60], [728, 90]];
    } else if (window.matchMedia('only screen and (min-width: 468px)').matches) {
      return [...baseSizes, [468, 60]];
    }
    return baseSizes;
  }

  /**
   * The skyscraper ad (on the right side of the content) has four different widths [300, 200, 160, 120]
   * As we don't want to destroy the layout, by showing ads with a bigger width than available space,
   * we compute if the screen is wide enough for the ads.
   * The main content is 1024px maximum. Based on this information we calculate the minimum screen size
   * for an ad with a certain width
   * @returns {DfpSlotSize[]}
   */
  private computeSkyScraperSlotSizes(): DfpSlotSize[] {
    if (window.matchMedia('only screen and (min-width: 1624px)').matches) {
      // [1, 1] is for the Just Premium Side Ad
      // 1024px + (2 * 300) = 1624
      return [[120, 600], [160, 600], [200, 600], [300, 600], [1, 1]];
    } else if ((window.matchMedia('only screen and (min-width: 1424px)').matches)) {
      // 1024px + (2 * 200) = 1424
      return [[120, 600], [160, 600], [200, 600], [1, 1]];
    } else if ((window.matchMedia('only screen and (min-width: 1350px)').matches)) {
      // 1350px is the `--desktop-full-viewport` which is the minimum width for the skyscraper column to be displayed
      return [[120, 600], [160, 600], [1, 1]];
    }
    return [];
  }

  private computeSkyScraperSlot(): DfpSlot[] {

    const skyscraperSizes = this.computeSkyScraperSlotSizes();

    // conly create skyscraper slot if we have space on the page
    if (skyscraperSizes.length !== 0) {
      return [new DfpPrebidSlot(
        new DfpSkyScraperSlot('ad-sidebar-skyScraper', skyscraperSizes), [
          appNexusPrebidConfigSkyscraperDesktop,
          improveDigitalPrebidConfigSkyscraperDesktop(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigSkyscraperDesktop,
          ...criteoPrebidConfigSkyscraperDesktop(skyscraperSizes),
          ...pubMaticPrebidConfigSkyscraperDesktop(skyscraperSizes),
          nanoInteractivePrebidConfigSkyscraperDesktop(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
          openxPrebidConfigSkyscraperDesktop,
          smartPrebidConfigSkyscraperDesktop
        ],
        this.prebidBanner(skyscraperSizes)
      )];
    } else {
      return [];
    }
  }

  /**
   * Calculates the possible leaderboard slots
   *
   * - header area
   * - related content
   *
   * The max sizes is defined by the question width as it defines the max width of the complete page.
   *
   * @returns {DfpSlot[]}
   */
  private computeHeaderAreaSlots(): DfpSlot[] {
    const allSizes: DfpSlotSize[] = ['fluid', [728, 90], [800, 225], [800, 250], [970, 80], [970, 90], [970, 250]];

    const sizes = this.isQdp() ? this.filterQuestionSize(allSizes) : this.filterByMainContent(allSizes);
    if (sizes.length === 0) {
      return [];
    }

    return [
      new DfpPrebidSlot(
        // [1, 1] is for the Just Premium Leaderboard/Billboard/Wallpaper
        new DfpHeaderAreaSlot('ad-presenter-desktop', [...sizes, [1, 1]]),
        [justPremiumPrebidConfigWallpaper,
          appNexusPrebidConfigHeaderAreaDesktop,
          improveDigitalPrebidConfigHeaderAreaDesktop(this.adConfiguration.marketingChannel.channel),
          ...indexExchangePrebidConfigHeaderAreaDesktop,
          ...criteoPrebidConfigHeaderAreaDesktop(sizes),
          ...pubMaticPrebidConfigHeaderArea(sizes),
          nanoInteractivePrebidConfigHeaderAreaDesktop(this.adConfiguration.tags.join(', '), this.adConfiguration.marketingChannel.channel),
          openxPrebidConfigHeaderAreaDesktop,
          smartPrebidConfigHeaderAreaDesktop
        ],
        this.prebidBanner([...sizes, [1, 1]])
      )
    ];
  }

  /**
   * Filters the given dfp slots if they have an equal or smaller width than the question plate.
   * @param {DfpSlotSize[]} sizes
   * @returns {DfpSlotSize[]} filter sizes. Can be empty!
   */
  private filterQuestionSize(sizes: DfpSlotSize[]): DfpSlotSize[] {
    const question = document.querySelector('[data-ref=Question]');
    const questionSize = question ? question.getBoundingClientRect().width : 0;
    return sizes.filter(size => {
      // filter all sizes that fit
      return size === 'fluid' ? true : size[0] <= questionSize;
    });
  }

  /**
   * Filters the given dfp slots if they have an equal or smaller width than the main content.
   *
   * @param {DfpSlotSize[]} sizes
   * @returns {DfpSlotSize[]} filter sizes. Can be empty!
   */
  private filterByMainContent(sizes: DfpSlotSize[]): DfpSlotSize[] {
    const mainContent = document.querySelector('[data-ref=ad-measure-main]');
    const questionSize = mainContent ? mainContent.getBoundingClientRect().width : 0;
    return sizes.filter(size => {
      // filter all sizes that fit
      return size === 'fluid' ? true : size[0] <= questionSize;
    });
  }

  /**
   *
   */
  private computeQuestionDetailAdSlotSizes(): DfpSlotSize[] {
    /** Size mappings for device categories. */
    const defaultSizes: {
      smallMobile: DfpSlotSize[],
      mobile: DfpSlotSize[],
      // Smaller desktop ( or tablet in portrait mode ). These sizes were optimized for the old platform and
      // are currently reused on NMMS to compare the ad performance on both platforms.
      // With further optimizations these sizes may be merged into the `desktop` size definition.
      smallDesktop: DfpSlotSize[],
      // Desktop sizes optimized for NMMS. Include the the `smallDesktop` sizes as well to allow DFP to choose the
      // best performing sizes for the given slot.
      desktop: DfpSlotSize[]
    } = {
      smallMobile: ['fluid', [250, 250], [280, 185], [300, 300], [300, 250], [300, 150], [300, 100], [300, 50], [300, 169], [1, 1]],
      mobile: ['fluid', [250, 250], [300, 300], [300, 250], [300, 150], [300, 100], [300, 50], [316, 185], [320, 100], [320, 150], [320, 50], [300, 169], [1, 1]],
      smallDesktop: ['fluid', [536, 165], [536, 302], [1, 1]],
      desktop: ['fluid', [605, 165], [605, 340], [1, 1]]
    };

    // Get the container of the question detail content.  If the container is missing, return an empty array, because
    // we don't have any qdp slots on non-qdp pages.
    const questionDetailBlock = document.querySelector('[data-ref=Question]');
    if (!questionDetailBlock && this.isQdp()) {
      // this warning will also trigger during pattern-lab development
      this.logger.error('[AdInventory] Question div not detected: !!!NO pos1-pos5 ads display!!!');
      return defaultSizes.smallMobile;
    } else if (!questionDetailBlock) {
      return [];
    } else {
      // The QDP ad slots sit within a plate which has a certain padding, so for the proper size of the ad slot we need
      // to figure out the "inner" width of a plate, the width without margin, border _and_ padding that is.
      //
      // We added a handlebars atom ('ad-measure') whose only purpose is to measure the width of the answer plates.
      // The 'ad-measure' is not visible but has always the same width as the answer-plates.
      // To figure out the "inner" width, we substract the answer-plate padding manually.
      // If the layout is changed, we need to change the calculation here as well!!
      //
      // The wording 'desktop', 'smallDesktop', 'mobile' and 'smallMobile' is a little bit confusing here.
      // For Ads, We don't differentiate between devices but between the answer plate's size.
      // The widest Ad of a category needs to fit into the answer plate (minus padding, minus border).
      // Problem is, for small screens there is no sidebar. That's why the answer plates get bigger for smaller devices.
      // Attention: the padding for the biggest device category is 25px, for all other category its' 20px.
      // The border is always 1px
      //
      // _desktop       = Answer Plate >= 605 + 2*25 + 2*1 = 657 || Screen Size >= 1024 OR ]768, 382]
      // _smallDesktop  = Answer Plate >= 536 + 2*20 + 2*1 = 578 || Screen Size ]1024, 945]
      // _mobile        = Answer Plate >= 320 + 2*20 + 2*1 = 362 || Screen Size ]945, 768]
      // _smallMobile   = Answer Plate >= 300 + 2*20 + 2*1 = 342 || Screen Size ]382, 0[
      //
      const adMeasure = document.querySelector('[data-ref="ad-measure"]');
      const adMeasureWidth = adMeasure ? adMeasure.getBoundingClientRect().width : 0;
      if (adMeasureWidth === 0) {
        this.logger.error('[AdInventory] ad-measure div not detected: !!!NO pos1-pos5 ads display!!!');
        return [];
      } else if (adMeasureWidth >= 657) {
        return defaultSizes.desktop;
      } else if (adMeasureWidth >= 578) {
        return defaultSizes.smallDesktop;
      } else if (adMeasureWidth >= 362) {
        return defaultSizes.mobile;
      } else {
        return defaultSizes.smallMobile;
      }
    }
  }

  private listingPagesAdSlots(): DfpSlot[] {
    return [
      new DfpListingFluidPositionSlot('ad-listingpages-2', 'pos2'),
      new DfpListingFluidPositionSlot('ad-listingpages-3', 'pos3'),
      new DfpListingFluidPositionSlot('ad-listingpages-4', 'pos4'),
    ];
  }

  private prebidBanner(dfpSlotSizes: DfpSlotSize[]): prebidjs.IMediaTypes {
    return {
      banner: {
        sizes: this.filterPrebidSizes(dfpSlotSizes)
      }
    };
  }

  /**
   * Remove all 'fluid' sizes and other non prebid sizes.
   *
   * @param {DfpSlotSize[]} sizes
   * @returns {[number, number][]}
   */
  private filterPrebidSizes(sizes: DfpSlotSize[]): [number, number][] {
    /**
     * The sizes we have for our prebid line items defined.
     */
    const prebidSizes = [
      [1, 1],
      [120, 160], [160, 600],
      [300, 50], [300, 250], [300, 600], [320, 50],
      [605, 340],
      [468, 60], [728, 90], [800, 250], [970, 90], [970, 250]
    ];

    return sizes.filter(size => {
      // we have no fluid sizes for our prebid creatives
      if (size === 'fluid') {
        return false;
      } else {
        return prebidSizes.some(([width, height]) => {
          return width === size[0] && height === size[1];
        });
      }
    }) as [number, number][];
  }
}
