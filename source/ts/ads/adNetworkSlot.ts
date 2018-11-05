import { prebidjs } from '../types/prebidjs';

import * as AdRefreshListener from './refreshAd';
import { Moli } from '../types/moli';
import DfpSize = Moli.DfpSize;
import LazyLoadingBehaviour = Moli.behaviour.LazyLoadingBehaviour;
import RefreshableBehaviour = Moli.behaviour.RefreshableBehaviour;

/**
 * A DFP slot.
 */
export abstract class DfpSlot implements Moli.AdSlot {

  /**
   * The DOM element ID for this slot.
   */
  public abstract readonly domId: string;

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
  public abstract readonly sizes: DfpSize[];

  /** is this a dfp out-of-page (interstitial) slot or not */
  public abstract readonly position: 'in-page' | 'out-of-page';

  /** configure how and when the slot should be loaded */
  public abstract readonly behaviour: Moli.behaviour.SlotLoadingBehaviour;

  /**
   * Conditionally select the ad unit based on labels.
   * Labels are supplied by the sizeConfig object in the top level moli configuration.
   *
   * The API and behaviour matches the prebid API.
   * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
   * http://prebid.org/dev-docs/conditional-ad-units.html
   */
  public readonly labelAny?: string[];
  public readonly labelAll?: string[];

  /** an optional prebid configuration if this ad slot can also be used by prebid SSPs */
  public readonly prebid?: {
    /** bids configuration */
    readonly bids: prebidjs.IAdUnit[]
  };

  /** optional a9 configuration if this ad slot can also be used by a9 */
  public readonly a9?: { readonly enabled: boolean };

  /**
   * The ad unit path, as per DoubleClick.
   */
  abstract get adUnitPath(): string;
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
 *   LazyLoading.FooterVisible(scrollService, windowEventService)
 * )
 *
 * @example prebid slot as lazy slot
 * // the lazy slot is the outer most element
 * new DfpSlotLazy(
 *   new DfpPrebidSlot(
 *     new DfpPerformanceBannerSlot('ad-performanceBanner'),
 *     [ ... prebid configuration ... ]
 *   ),
 *   LazyLoading.FooterVisible(scrollService, windowEventService)
 * )
 *
 * @see ILazyLoader for implementations
 */
export abstract class DfpSlotLazy extends DfpSlot {
  public readonly position = 'in-page';

  protected constructor(
    public readonly domId: string,
    public adUnitPath: string,
    public readonly sizes: DfpSize[],
    /**
     * some sort of lazy loading behaviour, to be defined by the slot itself (event or visibility)
     */
    public readonly behaviour: LazyLoadingBehaviour
  ) {
    super();
  }

  /**
   * Trigger when the ad should be refreshed and thus being loaded and displayed.
   *
   * TODO: implement refresh stub
   *
   * @returns {Promise<void>} resolves when the lazy loading logic triggers.
   */
  public onRefresh(): Promise<void> {
    return Promise.resolve();
  }
}

export class EventTriggeredDfpSlotLazy extends DfpSlotLazy {

  constructor(
    public readonly domId: string,
    public adUnitPath: string,
    public readonly sizes: DfpSize[],
    triggerEvent: string
  ) {
    super(domId, adUnitPath, sizes, {
      name: 'lazy',
      trigger: {
        name: 'event',
        event: triggerEvent
      }
    });
  }

}

export class VisibilityTriggeredDfpSlotLazy extends DfpSlotLazy {

  constructor(
    public readonly domId: string,
    public adUnitPath: string,
    public readonly sizes: DfpSize[],
    triggerElementDomId: string
  ) {
    super(domId, adUnitPath, sizes, {
      name: 'lazy',
      trigger: {
        name: 'visible',
        domId: triggerElementDomId
      }
    });
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

  /**
   * refreshable slot loading behaviour
   *
   * TODO: wire behaviour and refresh listener together
   */
  readonly behaviour: RefreshableBehaviour = {
    name: 'refreshable',
    trigger: {
      name: 'event',
      event: this.refreshEventName
    }
  };

  readonly position = 'in-page';

  public constructor(
    public readonly domId: string,
    public adUnitPath: string,
    public readonly sizes: DfpSize[],
    private refreshListener: AdRefreshListener.IAdRefreshListener,
    private refreshEventName: string
  ) {
    super();
  }

  setRefeshListener(func: EventListenerOrEventListenerObject): void {
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

  readonly position = 'in-page';

  public constructor(
    public readonly domId: string,
    public adUnitPath: string,
    public readonly sizes: DfpSize[],
    public readonly bids: prebidjs.IBid[],
    public readonly mediaTypes: prebidjs.IMediaTypes,
    /**
     * any type of slot loading behaviour (EagerLoadingBehaviour / LazyLoadingBehaviour / RefreshableBehaviour)
     */
    public readonly behaviour: Moli.behaviour.SlotLoadingBehaviour
  ) {
    super();

    // Use prebid sizes and DfpSlot sizes as all sizes (used for dfp request)
    const bannerSizes = mediaTypes.banner ? mediaTypes.banner.sizes : [];
    const videoSize = mediaTypes.video ? [mediaTypes.video.playerSize] : [];
    const allSizes = [...this.sizes, ...bannerSizes, ...videoSize];

    // remove duplicates
    this.sizes = allSizes.reduce<DfpSize[]>((distinctSizes, size) => {
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
}
