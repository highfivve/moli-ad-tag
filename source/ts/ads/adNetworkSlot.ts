import { EVENT_LISTING_CARD_LOAD } from '../../../components/card-listing/index';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import * as LazyLoading from './lazyLoading';
import * as AdRefreshListener from './refreshAd';

/**
 * The type for DFP slot sizes
 */
export type DfpSlotSize = [number, number] | 'fluid';

/**
 * A DFP slot.
 */
export abstract class DfpSlot {
  readonly networkName: string = 'dfp';

  /**
   * The DOM element ID for this slot.
   */
  public abstract readonly id: string;

  /**
   * The sizes this ad slot supports.
   *
   * == Disclaimer ==
   * DFP requires the size parameter only for 'in-page' slots. 'Out-of-page' slots are defined without a size.
   * The `gpt.js` library sends a '1x1' size request for 'out-of-page' slots.
   *
   * We need this '1x1' size configuration explicitly in our code to configure a 'out-of-page' prebid slots
   * correctly as well.
   *
   */
  public abstract readonly size: DfpSlotSize[];

  /**
   * The ad unit path, as per DoubleClick.
   */
  abstract get adUnitPath(): string

  /**
   * Define this ad slot on the google tag service.
   *
   * @param googleTag The google tag service
   * @return The new ad slot
   */
  abstract defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot;

  get asDebugString(): string {
    let debug = '<div class="AdDebug">';
    for (let property in this.asDebugObject) {
      if (this.asDebugObject.hasOwnProperty(property) && this.asDebugObject[property]) {
        debug = debug.concat(this.propertyToHTML(property, this.asDebugObject[property]));
      }
    }
    debug = debug.concat('</div>');
    return debug;
  }

  protected abstract get asDebugObject(): { [index: string]: any }

  protected propertyToHTML(key: string, value: Object): string {
    return `<div class="AdDebug-row">
              <div class="AdDebug-cell AdDebug-property u-smaller">${key}:</div>
              <div class="AdDebug-cell AdDebug-value u-smaller">${value.toString()}</div>
            </div>`;
  }
}

/**
 * == A lazy DFP Slot ==
 *
 * Wrap arbitrary DFPSlots along with a LazyLoader implementation.
 * You can also wrap a DfpPrebidSlot to allow lazy loaded slots along with header bidding.
 *
 * @example regular slot as lazy slot
 * // wrap another slot into a lazy loaded slot along with the lazy loading logic.
 * new DfpSlotLazy(
 *   new DfpPerformanceBannerSlot('im-performanceBanner', [[988, 250]]),
 *   LazyLoading.FooterVisible(queryService, scrollService, windowEventService)
 * )
 *
 * @example prebid slot as lazy slot
 * // the lazy slot is the outer most element
 * new DfpSlotLazy(
 *   new DfpPrebidSlot(
 *     new DfpPerformanceBannerSlot('ad-performanceBanner'),
 *     [ ... prebid configuration ... ]
 *   ),
 *   LazyLoading.FooterVisible(queryService, scrollService, windowEventService)
 * )
 *
 * @see ILazyLoader for implementations
 */
export class DfpSlotLazy extends DfpSlot {

  public readonly id: string = this.slot.id;

  public readonly size: DfpSlotSize[] = this.slot.size;

  public constructor(public readonly slot: DfpSlot, private lazyLoader: LazyLoading.ILazyLoader) {
    super();
  }

  public get adUnitPath(): string {
    return this.slot.adUnitPath;
  }

  public defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    return this.slot.defineSlotOnGoogleTag(googleTag);
  }

  protected get asDebugObject(): { [index: string]: any } {
    return {
      'type': 'lazy',
      'innerSlot': this.slot.asDebugString
    };
  }

  /**
   * Trigger when the ad should be refreshed and thus being loaded and displayed.
   *
   * @returns {Promise<void>} resolves when the lazy loading logic triggers.
   */
  public onRefresh(): Promise<void> {
    return this.lazyLoader.onLoad();
  }
}

/**
 * == A refreshable DFP Slot ==
 *
 * Wrap arbitrary DFPSlots along with a Refreshable implementation.
 * Makes it possible to refresh an Ad inside of a slot,
 * e.g. for the Video Position, that we want to refresh when the anser sorting is changed
 *
 * @example regular slot as refreshable slot
 * // wrap another slot into a refreshable slot along with the refreshable logic.
 * new DfpSlotRefreshable(
 *   new DfpQDPPositionSlot('ad-answerstream-2', 'pos2', sizes),
 *   RefreshListener.AnswerSortingChanged()
 * )
 *
 * @see IAdRefreshListener for implementations
 */
export class DfpSlotRefreshable extends DfpSlot {

  readonly id: string = this.slot.id;

  readonly size: DfpSlotSize[] = this.slot.size;

  public constructor(public readonly slot: DfpSlot, private refreshListener: AdRefreshListener.IAdRefreshListener) {
    super();
  }

  get adUnitPath(): string {
    return this.slot.adUnitPath;
  }

  defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    return this.slot.defineSlotOnGoogleTag(googleTag);
  }

  protected get asDebugObject(): { [index: string]: any } {
    return {
      'type': 'refreshable',
      'innerSlot': this.slot.asDebugString
    };
  }

  setRefeshListener( func: (event: CustomEvent) => void): void {
    this.refreshListener.addAdRefreshListener(func);
  }
}

/**
 * == DFP Prebid Slot ==
 *
 * A prebid ad slot holds an additional prebid configuration along with a
 * concrete ad slot.
 *
 * The DFP service uses this configuration to request additional bids for
 * the given slot.
 *
 * Slot Size:
 *  - The Prebid sizes are defined through the mediaTypes object.
 *    Ideally, they are a subset of the dfp sizes.
 *  - The DFP sizes are the prebid sizes together with the dfp sizes. (duplicates removed)
 *
 */
export class DfpPrebidSlot extends DfpSlot {

  public readonly id: string = this.underlyingSlot.id;

  public readonly size: DfpSlotSize[];

  public constructor(private underlyingSlot: DfpSlot, public readonly bids: prebidjs.IBid[], public readonly mediaTypes: prebidjs.IMediaTypes) {
    super();

    // Use prebid sizes and DfpSlot sizes as all sizes (used for dfp request)
    const bannerSizes = mediaTypes.banner ? mediaTypes.banner.sizes : [];
    const videoSize = mediaTypes.video ? [mediaTypes.video.playerSize] : [];
    const allSizes = [...this.underlyingSlot.size, ...bannerSizes, ...videoSize];

    // remove duplicates
    this.size = allSizes.reduce<DfpSlotSize[]>((distinctSizes, size) => {
      const isInDistinctSizes = distinctSizes.some(s => {
        if (s === 'fluid') {
          return s === size;
        } else if (size === 'fluid') {
          return false;
        } else {
          return s[0] === size[0] && s[1] === size[1];
        }
      });
      return isInDistinctSizes ? distinctSizes : [...distinctSizes, size];
    }, []);
  }

  /**
   * amazon should use the banner sizes as sizes that they request
   */
  public prebidSizes(): [number, number][] {
    return this.mediaTypes.banner ? this.mediaTypes.banner.sizes : [];
  }

  public get adUnitPath(): string {
    return this.underlyingSlot.adUnitPath;
  }

  public defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    return this.underlyingSlot.defineSlotOnGoogleTag(googleTag);
  }

  protected get asDebugObject(): { [index: string]: any } {
    return {
      'type': 'prebid',
      'innerSlot': this.underlyingSlot.asDebugString
    };
  }
}

/**
 * == DFP OutOfPage Slot ==
 *
 * An out-of-page slot enables ad formats like
 *  - pop-ups
 *  - pop-unders
 *  - floating-creatives
 *
 * @see https://support.google.com/dfp_premium/answer/6088046?hl=de
 */
export abstract class DfpOutOfPageSlot extends DfpSlot {

  /**
   * An out-of-page slot has a predefined size of [1,1].
   */
  public readonly size: [[number, number]] = [[1, 1]];

  public defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    return googleTag.defineOutOfPageSlot(this.adUnitPath, this.id);
  }

  protected get asDebugObject(): { [index: string]: any } {
    return {
      'type': 'out-of-page',
      'id': this.id,
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * == DFP QDP OutOfPage Mobile Interstitial Slot ==
 *
 * Mobile popups on the question-detail-page
 *
 * @see https://support.google.com/dfp_premium/answer/6088046?hl=de
 */
export class DfpQdpOutOfPageMobileInterstitialSlot extends DfpOutOfPageSlot {

  constructor(public id: string) {
    super();
  }

  public get adUnitPath(): string {
    return '/33559401/gf/fragen/Mobile_Interstitial';
  }

}

/**
 * PopUnder Slot on desktop
 */
export class DfpQdpOutOfPagePopUnderSlotDesktop extends DfpOutOfPageSlot {

  constructor(public id: string) {
    super();
  }

  public get adUnitPath(): string {
    return '/33559401/gf/fragen/PopUnder';
  }

}

/**
 * == Floor Ad ==
 *
 * An overlay at the bottom of the viewport.
 *
 */
export class DfpQdpOutOfPageFloorSlotDesktop extends DfpOutOfPageSlot {

  constructor(public id: string) {
    super();
  }

  public get adUnitPath(): string {
    return '/33559401/gf/FloorAd';
  }

}

/**
 * A regular ad slot that sits within the page content.
 */
export abstract class DfpInPageSlot extends DfpSlot {

  public defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    return googleTag.defineSlot(this.adUnitPath, this.size, this.id);
  }
}

/**
 * A position slot for QDP.
 */
export class DfpQDPPositionSlot extends DfpInPageSlot {
  constructor(public id: string, public position: string, public size: DfpSlotSize[]) {
    super();
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'regular',
      'id': this.id,
      'position': this.position,
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }

  get adUnitPath(): string {
    return `/33559401/gf/fragen/${this.position}`;
  }
}

/**
 * A related content position slot for QDP.
 */
export class DfpQDPRelatedContentPositionSlot extends DfpInPageSlot {
  constructor(public readonly id: string, public readonly position: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'regular',
      'id': this.id,
      'position': this.position,
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }

  get adUnitPath(): string {
    return `/33559401/gf/fragen/${this.position}`;
  }
}


/**
 * A position slot for DFP Listing Pages.
 */
export class DfpListingFluidPositionSlot extends DfpInPageSlot {
  public size: DfpSlotSize[] = ['fluid'];

  constructor(public id: string, public position: string) {
    super();
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'regular',
      'id': this.id,
      'position': this.position,
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }

  get adUnitPath(): string {
    return `/33559401/gf/Listing/${this.position}`;
  }

  public defineSlotOnGoogleTag(googleTag: googletag.IGoogleTag): googletag.IAdSlot {
    const adSlot = super.defineSlotOnGoogleTag(googleTag);

    // FIXME This refresh logic needs to be extracted
    const element = document.getElementById(this.id);
    if (element && element.parentNode) {
      element.parentNode.addEventListener(EVENT_LISTING_CARD_LOAD, () => {
        googleTag.pubads().refresh([adSlot]);
      });
    }
    return adSlot;
  }
}

/**
 * Sticky ad slot.
 */
export class StickySlot extends DfpInPageSlot {
  constructor(public id: string, public size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return '/33559401/gf/fragen/StickyAd_AdX';
  }

  protected get asDebugObject(): Object {
    return {
      'type:': 'sticky',
      'id': this.id,
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * A slot which only requests the "fluid", typically used for native ad formats.
 */
export abstract class DfpFluidSlot extends DfpInPageSlot {
  public size: DfpSlotSize[] = ['fluid'];

  constructor(public id: string) {
    super();
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'native',
      'id': this.id,
      'position': 'related-questions',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * Slot in top-position of related questions ("Auch interessant"), used for native ads like sponsored posts.
 */
export class RelatedQuestionsTopSlot extends DfpFluidSlot {
  get adUnitPath(): string {
    return '/33559401/gf/fragen/Related_Questions';
  }
}

/**
 * Sidebar slot on top of recommended questions, used for native ads like sponsored posts.
 */
export class RecommendedQuestionsSidebarSlot extends DfpFluidSlot {
  get adUnitPath(): string {
    return '/33559401/gf/fragen/Similar_Questions';
  }
}

/**
 * "pos0" slot on QDP, above the very first answer.  Only used for native ads like sponsored posts or marketing banners.
 */
export class QDPPos0Slot extends DfpFluidSlot {
  get adUnitPath(): string {
    return '/33559401/gf/fragen/pos0';
  }
}

/**
 * Presenter position on mobile
 */
export class DfpPresenterMobileSlot extends DfpInPageSlot {

  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return '/33559401/gf/fragen/Presenter_Mobile';
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'presenter',
      'id': this.id,
      'position': 'mobile top',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * == DFP Wallpaper Pixel Slot ==
 *
 * This AdSlot coordinates the `DfpHeaderAreaSlot` and `DfpSkyScraperSlot` adUnit.
 * It also functions as a tracking adSlot to measure wallpaper traffic and revenue.
 *
 * The idea is that a single line item contains 3 creatives that match exactly
 * - the DfpWallpaperPixelSlot
 * - the DfpHeaderAreaSlot (leaderboard)
 * - the DfpSkyScraperSlot (skyscraper)
 *
 * In DFP we use the "guaranteed roadblock" feature to ensure that the line item is only targeted
 * if _all_ three creatives are delivered at the same time, thus making sure that we have a single
 * wallpaper ad and no single leaderboard or skyscraper ad.
 *
 * @see https://confluence.gutefrage.net/display/DEV/Sonderformate
 */
export class DfpWallpaperPixelSlot extends DfpInPageSlot {

  /** this slot is not displayed, so we simply ask for a 1x1 size */
  public readonly size: DfpSlotSize[] = [[1, 1]];

  constructor(public readonly id: string) {
    super();
  }

  get adUnitPath(): string {
    return '/33559401/gf/wallpaper-pixel';
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'wallpaper-pixel',
      'id': this.id,
      'position': 'none',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }

}

/**
 * Presenter position on desktop.
 */
export class DfpHeaderAreaSlot extends DfpInPageSlot {

  public static readonly adUnitPath = '/33559401/gf/fragen/HeaderArea';

  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return DfpHeaderAreaSlot.adUnitPath;
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'presenter',
      'id': this.id,
      'position': 'desktop top',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * Sidebar slots for desktop.
 */
export abstract class DfpSidebarSlot extends DfpInPageSlot {

  protected get asDebugObject(): Object {
    return {
      'type': 'regular',
      'id': this.id,
      'position': 'sidebar',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * Sidebar slot for the medium rectangle
 * on top of the related questions section on desktop.
 */
export class DfpSidebarSlot1 extends DfpSidebarSlot {

  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return '/33559401/gf/fragen/Sidebar_1';
  }
}

/**
 * Sidebar slot for the second medium rectangle
 * under the related questions section on desktop.
 * (former Business Profile Teaser)
 */
export class DfpSidebarSlot2 extends DfpInPageSlot {
  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  /**
   * We  couldn't change the adunit path, but in DFP this slot is named "sitebar_2".
   *
   * sitebar_2" - unfortunately an explicit typo :(
   * through out our code we will call it correctly "sidebar" as it's a bar on the side of the main content,
   * not a a bar on the site. IM called it sitebar, which urged our Sales team to do the same. IM's legacy will
   * stick with us forever now.
   * @returns {string}
   */
  get adUnitPath(): string {
    return '/33559401/gf/fragen/BusinessProfil_300x250';
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'regular',
      'id': this.id,
      'position': 'sidebar',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * Sidebar slot next to the related questions section on desktop.
 */
export class DfpSidebarSlot3 extends DfpSidebarSlot {

  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  /**
   * "sitebar_3" - unfortunately an explicit typo :(
   * through out our code we will call it correctly "sidebar" as it's a bar on the side of the main content,
   * not a a bar on the site. IM called it sitebar, which urged our Sales team to do the same. IM's legacy will
   * stick with us forever now.
   * @returns {string}
   */
  get adUnitPath(): string {
    return '/33559401/gf/fragen/Sitebar_3';
  }
}

/**
 * Sidebar slot for the skyscraper on desktop.
 */
export class DfpSkyScraperSlot extends DfpInPageSlot {

  constructor(public readonly id: string, public readonly size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return '/33559401/gf/fragen/Sidebar_rechts';
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'sky',
      'id': this.id,
      'position': 'sidebar',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}

/**
 * IM performance banner loaded via DFP. The ad unit is defined by IM
 * and hosted on the DFP instance of IM.
 *
 * The ad only gets loaded when it's inside the visible viewport of the user.
 */
export class DfpInteractiveMediaPerformanceBannerSlot extends DfpInPageSlot {

  constructor(public id: string, public size: DfpSlotSize[]) {
    super();
  }

  get adUnitPath(): string {
    return '/4444/gutefrage.net_im/Performance';
  }

  protected get asDebugObject(): Object {
    return {
      'type': 'im-performanceBanner',
      'id': this.id,
      'position': 'bottom',
      'adUnitPath': this.adUnitPath,
      'sizes': this.size.join(' | ')
    };
  }
}
