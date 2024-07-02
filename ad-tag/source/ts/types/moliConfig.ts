import { prebidjs } from './prebidjs';
import { SupplyChainObject } from './supplyChainObject';
import { apstag } from './apstag';
import { MoliRuntime } from './moliRuntime';
import { SyncDelay } from 'ad-tag/ads/modules/emetriq';
import {
  EmetriqAdditionalIdentifier,
  EmetriqParams,
  EmetriqCustomParam
} from 'ad-tag/types/emetriq';

export type GoogleAdManagerSlotSize = [number, number] | 'fluid';

/**
 * KeyValue map. Last insert wins.
 */
export interface GoogleAdManagerKeyValueMap {
  [key: string]: string | string[] | undefined;
}

/**
 * Type for a device where Moli could possibly be run on.
 * Web mostly uses mobile or desktop the device.
 *
 * We also support android and ios for 'wrapper apps' that use a webview to display the content.
 *
 */
export type Device = 'mobile' | 'desktop' | 'android' | 'ios';

export type AdServer = 'gam' | 'prebidjs';

/**
 * ## Production
 *
 * The production environment enables all requests to DFP / Prebid / A9
 * and other 3rd party module the ad tag may provide.
 *
 * This environment needs to be set if the ad tag should be used live.
 *
 * ## Test
 *
 * The test environment disables all calls to external services and instead
 * renders placeholder in all available ad slots.
 *
 * This environment is recommended for early testing to get some visual feedback.
 *
 */
export type Environment = 'production' | 'test';

/**
 * Add targeting information from the ad tag. Usually these are static values.
 * Dynamic values should be added via the MoliTag API `setTargeting(key, value)` or `addLabel(label)`.
 */

export type AdUnitPathVariables = {
  readonly [key: string]: string;
};

export interface Targeting {
  /** static or supplied key-values */
  readonly keyValues: GoogleAdManagerKeyValueMap;

  /**
   * A list of key-value keys that should not be sent to the ad manager.
   * This setting is not yet configurable via API as this should be static
   * and defined in the ad tag.
   */
  readonly adManagerExcludes?: string[];

  /** additional labels. Added in addition to the ones created by the sizeConfig. */
  readonly labels?: string[];

  /** ad unit path variables */
  readonly adUnitPathVariables?: AdUnitPathVariables;
}

/**
 * Additional configuration for single page application publishers.
 */
export interface SinglePageAppConfig {
  /**
   * Set to true if this publisher has a single page application.
   */
  readonly enabled: boolean;

  /**
   * If set to `false`, `requestAds` will not destroy all existing ad slots,
   * but only the ones being requested.
   *
   * Use with caution and test properly.
   *
   * ## Use cases
   *
   * This setting can be used for publishers that have more "static" ad slots, like
   * mobile sticky, footer ad or skyscraper that should not be destroyed on every page navigation
   * and that have users that navigation a lot on the page, e.g. swiping through images or profiles.
   * With this setting the more persistent ad slots are refreshed through ad reload or timed by the
   * publisher, while other content positions are refreshed on navigation.
   *
   * @default true
   */
  readonly destroyAllAdSlots?: boolean;

  /**
   * If set to `href`
   * - the ad tag will only allow one `requestAds` call per `href`
   * - requires `moli.requestAds()` to be called once per page, otherwise `moli.refreshAdSlot` will queue calls
   *
   * All available options are:
   * - `href` - the ad tag will only allow one `requestAds` call per `href`
   * - `path` - the ad tag will only allow one `requestAds` call per `path`
   * - `none` - the ad tag will allow multiple `requestAds` calls
   *
   * ## Use cases
   *
   * The default is `true` to ensure that subsequent `refreshAdSlot` calls are queued and not executed, if the URL
   * has already changed. This ensures that the `requestAds()` call has cleaned up all ad slots and state before
   * loading new ones.
   *
   * However, there are publishers that change the URL, e.g. for putting filter settings into the query and do not
   * call `moli.requestAds()`, because that's not a page change.
   *
   * @default true
   */
  readonly validateLocation: 'href' | 'path' | 'none';
}

/**
 * ## SizeConfig entry
 *
 * Configure sizes based on media queries for a single `IAdSlot`.
 *
 * This is the most complex part of a publisher ad tag setup. The size config defines
 *
 * - if an ad slot is loaded
 * - what sizes are requested
 *
 * This slot only supports the `mediaQuery` and `sizesSupported` property.
 * `labels` can only be defined globally as these can and should always be unique,
 * while the `sizesSupported` may overlap due to overlapping media queries.
 *
 * Example for overlapping configuration:
 *
 * ```typescript
 * [{
 *   // mobile devices support a medium rectangle
 *   mediaQuery: (max-width: 767px),
 *   sizesSupported: [[300,250]]
 * }, {
 *   // desktop sidebar supports medium rectangle
 *   mediaQuery: (min-width: 768px),
 *   sizesSupported: [[300,250]]
 * }]
 * ```
 *
 * This result in `[[300,250]]` being always supported, which may not be something you want.
 *
 * ### Using labels
 *
 * If you have the same slot on different page types with a different layout you can differentation size configs
 * via two properites
 *
 * - `labelAll` - all labels need to be present if this size config should be applied
 * - `labelNone` - none of the labels must be present if this size config should be applied
 *
 * ```typescript
 * [{
 *   // mobile devices support a medium rectangle
 *   mediaQuery: (max-width: 767px),
 *   labelAll: ['homepage'],
 *   sizesSupported: [[728,90]]
 * }, {
 *   // desktop sidebar supports medium rectangle
 *   mediaQuery: (min-width: 768px)
 *   labelNone: ['homepage']
 *   sizesSupported: [[728,90], [900,250]]
 * }]
 * ```
 *
 * ## Prebid API
 *
 * The API is identical to the Prebid size config feature. However, we do not pass the
 * size config down to prebid as we already apply the logic at a higher level. We only
 * pass the `labels` to the`requestBids({ labels })` call. Sizes are already filtered.
 *
 *
 * @see [Configure-Responsive-Ads](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads)
 * @see [Conditional Ad Units](https://prebid.org/dev-docs/conditional-ad-units.html)
 * @see [Size Mapping](https://prebid.org/dev-docs/examples/size-mapping.html)
 * @see [requestBids with labels](https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.requestBids)
 */
export interface SizeConfigEntry<Label = string> {
  /** media query that must match if the sizes are applicable */
  readonly mediaQuery: string;

  /** optional array of labels. All labels must be present if the sizes should be applied */
  readonly labelAll?: Label[];

  /** optional array of labels. All labels must **not** be present if the sizes should be applied */
  readonly labelNone?: Label[];

  /** static sizes that are support if the media query matches */
  readonly sizesSupported: GoogleAdManagerSlotSize[];
}

export interface LabelSizeConfigEntry {
  /** media query that must match if the labels are applicable */
  readonly mediaQuery: string;

  /** labels that are available if the media query matches */
  readonly labelsSupported: string[];
}

export type IPosition =
  | 'in-page'
  | 'out-of-page'
  | 'out-of-page-interstitial'
  | 'out-of-page-top-anchor'
  | 'out-of-page-bottom-anchor';

export interface AdSlot {
  /** id for the ad slot element */
  readonly domId: string;

  /** dfp adUnit path for this slot */
  readonly adUnitPath: string;

  /** the sizes for this ad slot */
  readonly sizes: GoogleAdManagerSlotSize[];

  /**
   * Configure the ad slot position
   *
   * - `in-page` is the standard display ad
   * - `out-of-page` uses the `defineOutOfPageSlot` API
   * - `out-of-page-interstitial` - `googletag.enums.OutOfPageFormat.INTERSTITIAL`
   * - `out-of-page-top-anchor` - `googletag.enums.OutOfPageFormat.TOP_ANCHOR`
   * - `out-of-page-bottom-anchor` - `googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR`
   *
   * @see [Display anchor ad](https://developers.google.com/publisher-tag/samples/display-anchor-ad)
   * @see [OutOfPageFormat](https://developers.google.com/publisher-tag/reference#googletag.enums.OutOfPageFormat)
   *
   */
  readonly position: IPosition;

  /** configure how and when the slot should be loaded */
  readonly behaviour: behaviour.SlotLoading;

  /**
   * Conditionally select the ad unit based on labels.
   * Labels are supplied by the sizeConfig object in the top level moli configuration.
   *
   * The API and behaviour matches the prebid API.
   * - [Configure-Responsive-Ads](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads)
   * - [Conditional Ad Units](https://prebid.org/dev-docs/conditional-ad-units.html)
   * - [Size Mapping](https://prebid.org/dev-docs/examples/size-mapping.html)
   */
  readonly labelAny?: string[];
  readonly labelAll?: string[];

  /**
   * Size configuration to support "responsive" ads.
   *
   * The implementation matches the prebid.js specification for responsive ads.
   * However, this information is not passed to prebid. The ad tag already takes
   * care of filtering sizes.
   *
   * @see [prebid configure responsive ads](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-Configure-Responsive-Ads)
   */
  readonly sizeConfig: SizeConfigEntry[];

  /**
   * Supplementary gpt configuration.
   * Gpt is always configured, regardless of the existence of this configuration.
   */
  readonly gpt?: gpt.GptAdSlotConfig;

  /** an optional prebid configuration if this ad slot can also be used by prebid SSPs */
  readonly prebid?: headerbidding.PrebidAdSlotConfigProvider;

  /** optional a9 configuration if this ad slot can also be used by a9 */
  readonly a9?: headerbidding.A9AdSlotConfig;

  /**
   * If true this ad slot will be refreshed if a window.postMessage event is being sent from
   * a creative identifying the ad slot by domId. In additional key value `passback:true` will
   * be set indicating this is a passback request. The rest of the key-values will be untouched
   * keeping the prebid / a9 auction key-values.
   *
   *
   * ## Example creative snippet
   *
   * This is an example of how a passback function could look like in a creative.
   * Note that you can either use the `adUnitPath` or the `domId` of the slot.
   *
   * `adUnitPath` is not yet fully supported, when using variables in the ad unit path.
   *
   * ```
   * var passbackCallback = function() {
   *   var request = JSON.stringify({
   *     type: 'passback',
   *     adUnitPath: '%%ADUNIT%%' ,
   *     passbackOrigin: '[ADVERTISER-NAME]'
   *   });
   *   try {
   *     // first try to post a message on the top most window
   *     window.top.postMessage(request, '*');
   *   } catch (_) {
   *     // best-effort postMessage
   *     window.postMessage(request, '*');
   *   }
   * }
   * ```
   *
   * Default is `false`
   */
  readonly passbackSupport?: boolean;
}

/*
 * Parameters to configure the resolve function
 */
export type ResolveAdUnitPathOptions = {
  /**
   * If set to true then the networkChildId will be removed from the ad unit path.
   * E.g.
   *
   * ```
   * /123,456/content_1`
   * ```
   *
   *
   *
   * ```
   * /123/content_1`
   * ```
   *
   * default: `false`
   */
  readonly removeNetworkChildId?: boolean;
};

/** consent configuration namespace */
export namespace consent {
  /**
   * Configuration additional consent configuration
   */
  export interface ConsentConfig {
    /**
     * Disables consent handling the ad tag. This has a handful of use cases
     *
     * 1. Debugging and testing, when the CMP has issues
     * 2. Disable for regions without data privacy legislation
     *
     * When disabled, moli will provide default values for
     *
     * * the `tcData` object in the ad request context. `gdprApplies` will be `0`
     */
    readonly enabled?: boolean;

    /**
     * If set to `true` ad requests will be aborted when there's only
     * legitimate interest established for at least one purpose.
     */
    readonly disableLegitimateInterest?: boolean;

    /**
     * If set to `false`, standard `gpt.js` will be loaded and not privacy configuration is set.
     *
     * From the google documentation examples
     *
     * > In order to manually control limited, you must load GPT from the limited ads URL. The version of GPT served
     * > from this URL contains additional safeguards against accessing client-side storage by default. To accomplish
     * > this, certain library operations are delayed until after the first call to display(), leading to a slight
     * > decrease in performance compared to the standard version of GPT.
     *
     * @default `true`
     * @see https://support.google.com/admanager/answer/9805023
     * @see https://developers.google.com/publisher-tag/samples/display-limited-ad?hl=en
     * @see https://developers.google.com/publisher-tag/reference?hl=de#googletag.PrivacySettingsConfig_nonPersonalizedAds
     */
    readonly useLimitedAds?: boolean;
  }
}

export namespace auction {
  export interface AdRequestThrottlingConfig {
    /** enable or disable this feature */
    readonly enabled: boolean;
    /**
     * the time in seconds that has to pass before a slot can be requested again
     */
    throttle: number;
  }

  export interface BidderDisablingConfig {
    /** enable or disable this feature */
    readonly enabled: boolean;

    /** minimum bid rate for a bidder to be disabled */
    readonly minRate: number;
    /** define a minimum number of bid requests sent by a bidder before it can be deactivated */
    readonly minBidRequests: number;

    /** milliseconds until a bidder becomes active again  */
    readonly reactivationPeriod: number;
  }

  export interface GlobalAuctionContextConfig {
    /**
     * Disable bidders that lack auction participation
     */
    readonly biddersDisabling?: BidderDisablingConfig;

    /**
     * Throttle ad requests for a slot to avoid flooding the ad server.
     * This is a general safeguard and should always be active. Mostly single page apps benefit from this, if a dev
     * misuses `React.useEffect` or similar implementations that constantly re-render and thus trigger ad requests.
     */
    readonly adRequestThrottling?: AdRequestThrottlingConfig;
  }
}

/** slot behaviour namespace */
export namespace behaviour {
  /**
   * ## Slot Loading
   *
   * The ad slot loading behaviour is configurable to support various use cases.
   *
   * ## Eager
   *
   * This is the most common use case. A slot is immediately requested and displayed.
   * There is no additional configuration necessary.
   *
   * @see [[EagerAdSlot]]
   *
   * ## Lazy
   *
   * This delays the ad request until a certain `trigger` is called. Use cases for this setting:
   *
   * 1. Show an ad slot when a certain element is visible
   * 2. Show an ad slot when a user performs a certain action (e.g. clicks a button)
   * 3. Show an ad slot only under certain conditions (e.g. x number of elements available)
   *
   * [DFP also offers a lazy loading feature](https://developers.google.com/doubleclick-gpt/reference#googletag.PubAdsService_enableLazyLoad), which
   * only covers the first use case.
   */
  export interface ISlotLoading {
    readonly loaded: 'eager' | 'manual' | 'infinite' | 'backfill';

    /**
     * Defines a bucket in which this slot should be loaded. This allows to publishers to configured a set of ad
     * slots that should run in a separate auction. This can have positive revenue impacts on some prebid partners
     * that bid poorly if too many placements are requested at once.
     *
     * Even though this property is available on all loading behaviours only `eager` have an effect as these are loaded immediately.
     *
     * All lazy slots are loaded in a separate auction anyway.
     *
     * For slots with a `manual` loading behaviour it's the publishers responsibility to load those in the proper
     * buckets.
     */
    readonly bucket?: string;
  }

  /**
   * An ad slot which is requested during page load.
   * This is the standard behaviour.
   */
  export interface Eager extends ISlotLoading {
    readonly loaded: 'eager';
  }

  /**
   * An ad slot which must be triggered via the `moli.refreshAdSlot` API.
   */
  export interface Manual extends ISlotLoading {
    readonly loaded: 'manual';
  }

  /**
   * The one infinite ad slot whose configuration will be copied if the `moli.refreshInfiniteAdSlot` API is triggered.
   *
   * This is mainly the case in combination with the lazy-loading module which needs a CSS selector
   * to identify the ad slots that should be lazily loaded PLUS get an automatic sequential numbering.
   *
   * Therefore, the `selector` configured here needs to be used in the lazy-loading module configuration. The module
   * looks for fitting HTML elements in the whole document of the browser window and refreshes them lazily using the
   * configuration of the 'infinite' slot.
   *
   * Also, it manages the moli debugger's display of how many infinite slots with the given selector are rendered at the moment.
   *
   * Valid examples (every CSS selector can be used):
   *
   * ```js
   * {
   *   loaded: 'infinite',
   *   selector: '.ad-infinite'
   * }
   * ```
   * or
   *
   * ```js
   * {
   *   loaded: 'infinite',
   *   selector: '[data-js="ad-infinite"]'
   * }
   * ````
   *
   */
  export interface Infinite extends ISlotLoading {
    readonly loaded: 'infinite';
    readonly selector: string;
  }

  /**
   * This loading behaviour describes slots that are loaded through a backfill integration.
   * A backfill slot is never loaded by default and needs to be refreshed manually along with the backfill option set.
   * This is neccessary to differentiate between slots that are loaded manually and slots that are loaded through a backfill integration.
   */
  export interface Backfill extends ISlotLoading {
    readonly loaded: 'backfill';
  }

  /**
   * all available slot loading behaviours.
   */
  export type SlotLoading = Eager | Manual | Infinite | Backfill;

  /** all available triggers for loading behaviours */
  export type Trigger = EventTrigger;

  /**
   * Triggers when a certain event is fired via `dispatchEvent` on window, document, or any other
   * element.
   */
  export interface EventTrigger {
    readonly name: 'event';

    /** the event name */
    readonly event: string;

    /**
     * the source that fires the event.
     * - window
     * - document
     * - or a query selector for a DOM Node
     */
    readonly source: Window | Document | string;
  }
}

/** gpt types */
export namespace gpt {
  /**
   * ## Gpt ad slot configuration
   */
  export interface GptAdSlotConfig {
    /**
     * Sets whether the slot div should be hidden when there is no ad in the slot.
     * Defaults to true.
     *
     * Correlates directly to googletag.IAdSlot.setCollapseEmptyDiv().
     */
    collapseEmptyDiv?: boolean;
  }
}

/** header bidding types */
export namespace headerbidding {
  /**
   * A `PrebidAdSlotConfig` can either be created
   *
   * - as a static value
   * - from a function which takes a `PrebidAdSlotContext`
   *
   * An ad slot config can either be a single value or an array of values.
   * Prebid merges those multiple definitions back into one. This allows size
   * configuration hacks, e.g. for the xaxis prebid integration.
   */
  export type PrebidAdSlotConfigProvider = PrebidAdSlotConfig | PrebidAdSlotConfig[];

  export type BidderSupplyChainNode = {
    readonly bidder: prebidjs.BidderCode;

    /**
     * The bidder specific supply chain node
     */
    readonly node: SupplyChainObject.ISupplyChainNode;

    /**
     * if true the `node` will be added to the supply chain configuration.
     */
    readonly appendNode: boolean;
  };

  export interface PrebidConfig {
    /** https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
    readonly config: prebidjs.IPrebidJsConfig;

    /** optional bidder settings */
    readonly bidderSettings?: prebidjs.IBidderSettings;

    /** prebid bidder supply chain configuration */
    readonly schain: {
      /** supply chain node for each bidder */
      readonly nodes: BidderSupplyChainNode[];
    };

    /**
     * if set to true the ad units will not be added via `pbjs.addAdUnits`, but created as ephemeral ad units each time
     * an auction is triggered.
     *
     * @default is false
     */
    readonly ephemeralAdUnits?: boolean;

    /**
     * A timeout in milliseconds for the prebid auction. If for whatever reason never calls the bidsBackHandler, this
     * timeout will be used to continue anyway to minimize the revenue impact.
     *
     * Note that the max of the auction timeout or failsafeTimeout will be used to avoid misconfiguration.
     *
     * The default is chosen to be 2000ms longer than the auction timeout to give the auction a chance to finish.
     * Usually auction timeouts range from 500ms to 3000ms, which makes 2000ms extra for a failsafe a fair guess.
     *
     * @default auction timeout + 2000ms
     */
    readonly failsafeTimeout?: number;

    /** optional listener for prebid events */
    // FIXME must be moved somewhere else. This is a runtime config thing for modules
    //  listener?: PrebidListenerProvider;
  }

  /**
   * Configuration for a prebid enabled ad slot
   */
  export interface PrebidAdSlotConfig {
    /**
     * bids configuration
     *
     * https://prebid.org/dev-docs/publisher-api-reference.html#addAdUnits-AdUnitProperties
     */
    readonly adUnit: prebidjs.IAdUnit;
  }

  /**
   * ## Amazon Publisher Audience
   *
   * Allow Amazon to target on hashed user email addresses when consent is given.
   */
  export interface A9PublisherAudienceConfig {
    /**
     * enabled or disable
     */
    readonly enabled: boolean;

    /**
     * user email address hashed with SHA256
     */
    readonly sha256Email: string;
  }

  /**
   * The maximum depth of the adUnitPath for a9 bid requests.
   */
  export type A9SlotNamePathDepth = 3 | 4 | 5;

  export interface A9Config {
    /**
     * publisher ID
     */
    readonly pubID: string;

    /**
     * Defaults to //c.amazon-adsystem.com/aax2/apstag.js
     */
    readonly scriptUrl?: string;

    /**
     * bids timeout for a9
     */
    readonly timeout: number;

    /**
     * timeout for the cmp provider to return a consent string
     */
    readonly cmpTimeout: number;

    /**
     * If set to true the yield optimization floor price will be sent to amazon.
     *
     * default: false
     */
    readonly enableFloorPrices?: boolean;

    /**
     * Configure the floor price currency. Will be mandatory once the feature is out of beta.
     */
    readonly floorPriceCurrency?: apstag.Currency;

    /**
     * all sizes that requests will be made for and are supported by a9.
     *
     * default: requesting all sizes that are defined in the adSlot configuration.
     */
    readonly supportedSizes?: GoogleAdManagerSlotSize[];

    /**
     * Configure the Amazon _Publisher Audiences_ feature.
     */
    readonly publisherAudience?: A9PublisherAudienceConfig;

    /**
     * Configure the maximum depth for all slotName paths in a9 requests.
     */
    readonly slotNamePathDepth?: A9SlotNamePathDepth;

    /**
     * Supply Chain Object for Amazon TAM
     */
    readonly schainNode: SupplyChainObject.ISupplyChainNode;
  }

  /**
   * ## A9 ad slot configuration
   *
   * Most of the a9 configuration is derived from the [[IAdSlot]] definition that provides
   * the configuration.
   *
   * - `slotID` - is defined by the slot `domId`
   * - `slotName` - is defined by the slot `adUnitPath`
   * - `sizes` - is defined by the slot `sizes`
   *
   *
   * @see [[apstag.ISlot]] internal A9 apstag documentation.
   */
  export interface A9AdSlotConfig {
    /** Filter ad slot based on the given labels */
    readonly labelAll?: string[];
    /** Filter ad slot based on the given labels */
    readonly labelAny?: string[];
    /** Optional media type (default to display) */
    readonly mediaType?: 'display' | 'video';
    /** Optional configuration of the maximum depth for the slotName path of this adSlot. (overrides the value in the global a9 config) */
    readonly slotNamePathDepth?: A9SlotNamePathDepth;
  }
}

/**
 * Global schain configuration for the ad tag
 */
export namespace schain {
  /**
   * Config object for the supply chain
   */
  export interface SupplyChainConfig {
    /**
     * All supply chain object node arrays will start with this node.
     * This should be the saleshouse or publisher that triggers the bid requests.
     */
    readonly supplyChainStartNode: SupplyChainObject.ISupplyChainNode;
  }
}

export namespace bucket {
  /**
   * ## Bucket config
   *
   * General settings for ad slot loading in buckets.
   *
   * ## Bucket use cases
   *
   * There are several use cases
   *
   * ### Bidder performance
   *
   * There are bidders (e.g. IndexExchange, Yieldlab) that have a better performance if a single request contains
   * only a small amount of placement ids. Buckets allow the publisher to group ad slots together and run in a
   * separate auction.
   *
   * ### Above and below the fold
   *
   * It's possible to bucket ad slots with higher priority.
   * NOTE: there's no feature for delay or prioritization yet!
   *
   */
  export interface GlobalBucketConfig {
    /**
     * if set to true, ad slots will be loaded in buckets as specified in the
     * ad slot configuration.
     *
     * Default: false
     */
    readonly enabled: boolean;

    /**
     * to customize the timeout per bucket, which overrides the Prebid's/A9 timeout.
     */
    readonly bucket?: BucketConfigMap;
  }

  export interface BucketConfig {
    /**
     * timeout used for prebid / a9 requests in this bucket
     */
    readonly timeout: number;
  }

  export type BucketConfigMap = {
    readonly [bucketName: string]: BucketConfig;
  };
}

/**
 * == Cleanup Module ==
 *
 * Cleans up special formats if enabled (on user navigation and ad reload), especially useful for SPAs.
 *
 * The configs can either provide CSS selectors of the html elements that are part of the special/out-of-page formats and should be deleted
 * or JS as a string that will be evaluated by the module in order to remove these elements.
 *
 * @see cleanup module
 */

export interface CSSDeletionMethod {
  /**
   * The CSS selectors of the html elements in the DOM that should be removed.
   */
  readonly cssSelectors: string[];
}

export interface JSDeletionMethod {
  /**
   * JavaScript code as a string that will be executed as given
   * (and most likely deletes the html elements of the special format).
   */
  readonly jsAsString: string[];
}

export interface CleanupConfig {
  /**
   * The bidder that offers the special format.
   */
  readonly bidder: prebidjs.BidderCode;
  /**
   * The domId of the slot on which the special format runs.
   */
  readonly domId: string;
  /**
   * The method how the special format should be cleaned up.
   */
  readonly deleteMethod: CSSDeletionMethod | JSDeletionMethod;
}

export namespace modules {
  export interface IModuleConfig {
    /**
     * If set to true the module will be enabled.
     */
    readonly enabled: boolean;
  }

  export namespace adreload {
    export type RefreshIntervalOverrides = {
      [slotDomId: string]: number;
    };

    export type UserActivityParameters = {
      /**
       * The duration in milliseconds the page is considered to be "actively used" after the last user action. Changes to page visibility
       * always directly set the state to inactive.
       */
      readonly userActivityDuration: number;

      /**
       * The duration in milliseconds after that we start listening for new user actions to keep the "active" state. This was introduced
       * such that we don't keep up expensive listeners on all user actions all the time.
       *
       * Must be smaller than userActivityDuration.
       */
      readonly userBecomingInactiveDuration: number;
    };

    /**
     * Used to configure the strictness of user activity checks.
     */
    export type UserActivityLevelControl =
      | { level: 'strict' }
      | { level: 'moderate' }
      | { level: 'lax' }
      | ({ level: 'custom' } & UserActivityParameters);

    export interface AdReloadModuleConfig extends IModuleConfig {
      /**
       * Ad slots that should never be reloaded
       */
      excludeAdSlotDomIds: string[];

      /**
       * Ad slots that have an influence on content positioning should be included here. The ad reload
       * module will make sure that reloading these slots will not negatively impact CLS scores.
       *
       * @see https://web.dev/cls/
       */
      optimizeClsScoreDomIds: string[];

      /**
       * Include list for advertisers that are eligible to be reloaded.
       * The id can be obtained from your google ad manager in the admin/company section.
       */
      includeAdvertiserIds: number[];

      /**
       * Include list for yield group ids that are eligible to be reloaded.
       * The id can be obtained from your google ad manager in the yield_group/list section.
       */
      includeYieldGroupIds: number[];

      /**
       * Include list for orders that are eligible to be reloaded.
       */
      includeOrderIds: number[];

      /**
       * Exclude list for orders that are eligible to be reloaded.
       */
      excludeOrderIds: number[];

      /**
       * Time an ad must be visible before it can be reloaded.
       */
      refreshIntervalMs?: number;

      /**
       * Configures an override for the default refresh interval configured in
       * `refreshIntervalMs` per ad slot.
       */
      refreshIntervalMsOverrides?: RefreshIntervalOverrides;

      /**
       * Configure what defines a user as active / inactive.
       */
      userActivityLevelControl?: UserActivityLevelControl;

      /**
       * Enable reloading ads that are not in viewport. It is not advised to use this option.
       * Impressions are usually only counted on ads that have been 50% visible and it's generally not
       * very user-centric to load stuff that is out of viewport.
       */
      disableAdVisibilityChecks?: boolean;
    }
  }

  export namespace cleanup {
    export interface CleanupModuleConfig extends IModuleConfig {
      /**
       * Information about whether the cleanup module is enabled or not.
       */
      readonly enabled: boolean;
      /**
       * A list of configurations.
       */
      readonly configs: CleanupConfig[];
    }
  }

  export namespace pubstack {
    export interface PubstackConfig extends IModuleConfig {
      /**
       * TagID from pubstack
       */
      readonly tagId: string;
    }
  }

  export namespace confiant {
    export interface ConfiantConfig extends IModuleConfig {
      /**
       * Confiant loads a single javascript file that contains all the configuration properties
       */
      readonly assetUrl: string;

      /**
       * Confiant has no defined purposes (state 2023-05-08) and some CMPs (Sourcepoint) exclude it from TC String.
       * This makes it impossible to check if consent is given or not.
       *
       * If Confiant decides to add a purpose, we can use this flag to immediately turn on the check again.
       * As a safeguard purpose-1 is mandatory to load confiant.
       *
       * @default false
       */
      readonly checkGVLID?: boolean;
    }
  }

  export namespace adex {
    export interface AdexAppConfig {
      /**
       * key within the moli config keyValues in which the client type is defined
       */
      readonly clientTypeKey: string;
      /**
       * key within the moli config keyValues in which the advertising id can be found
       */
      readonly advertiserIdKey: string;
      /**
       * extra tag id for the mobile endpoint data if distinction is wanted/necessary
       */
      readonly adexMobileTagId?: string;
    }

    export type MappingDefinition =
      | MappingDefinitionToAdexString
      | MappingDefinitionToAdexNumber
      | MappingDefinitionToAdexMap
      | MappingDefinitionToAdexList;

    export type AdexListObject = { [key: string]: 1 };

    /**
     * Adex lists are not really lists. They consist of objects with the list items as keys, and the
     * literal 1 as value:
     *
     * @example
     * {
     *   "Automotive": 1,
     *   "Oldtimers": 1,
     *   "Car Repair": 1
     * }
     */
    export type AdexList = {
      [key: string]: AdexListObject;
    };

    export type AdexKeyValuePair = {
      [key: string]: string | number;
    };
    export type AdexKeyValueMap = {
      [key: string]: AdexKeyValuePair;
    };
    export type AdexKeyValues = AdexKeyValuePair | AdexKeyValueMap | AdexList;

    export interface ToAdexMapping {
      readonly key: string;
      readonly attribute: string;
    }

    export interface MappingDefinitionToAdexList extends ToAdexMapping {
      readonly adexValueType: 'list';
      readonly defaultValue?: Array<string>;
    }

    export interface MappingDefinitionToAdexMap extends ToAdexMapping {
      readonly adexValueType: 'map';
      readonly valueKey: string;
      readonly valueType: 'number' | 'string';
      readonly defaultValue?: number | string;
    }

    export interface MappingDefinitionToAdexNumber extends ToAdexMapping {
      readonly adexValueType: 'number';
      readonly defaultValue?: number;
    }

    export interface MappingDefinitionToAdexString extends ToAdexMapping {
      readonly adexValueType: 'string';
      readonly defaultValue?: string;
    }

    export interface AdexConfig extends IModuleConfig {
      /**
       * Provided by your ADEX account manager.
       */
      readonly adexCustomerId: string;

      /**
       * Provided by your ADEX account manager.
       */
      readonly adexTagId: string;
      /**
       * For single page apps, enable spaMode. Tracking is then executed once per configuration cycle.
       * In regular mode, tracking is only executed once.
       */
      readonly spaMode: boolean;
      /**
       * extraction and conversion rules to produce Adex compatible data from key/value targeting.
       */
      readonly mappingDefinitions: Array<MappingDefinition>;
      /**
       * If there's an app version of the site, add the appConfig in order to make sure mobile data is sent to the Adex
       */
      readonly appConfig?: AdexAppConfig;
    }
  }

  export namespace blocklist {
    export type BlocklistEntry = {
      /**
       * A regex pattern for the complete href of the page
       */
      readonly pattern: string;

      /**
       * Defines how the pattern should be matched against the url
       *
       * - `regex` - transform the pattern into a regex and runs `regex.test(url)`
       * - `contains` - checks if the url contains the given pattern string
       * - `exact` - checks if the url exactly matches the given pattern string
       */
      readonly matchType: 'regex' | 'contains' | 'exact';
    };

    export type Blocklist = {
      readonly urls: BlocklistEntry[];
    };

    /**
     * A fixed set of blocklisted urls. Requires an ad tag update if new entries should be added
     */
    export type StaticBlocklistProvider = {
      readonly provider: 'static';

      readonly blocklist: Blocklist;
    };

    /**
     * The dynamic configuration provider that lets you update entries without updating the ad tag
     */
    export type DynamicBlocklistProvider = {
      readonly provider: 'dynamic';

      /**
       * Fetch the blocklist json from the specified endpoint
       */
      readonly endpoint: string;
    };

    export type BlocklistProvider = StaticBlocklistProvider | DynamicBlocklistProvider;

    export interface BlocklistUrlsBlockingConfig extends IModuleConfig {
      /**
       * `block` - this mode blocks ad requests entirely
       * `key-value` - sets a specified key value
       */
      readonly mode: 'block';

      /**
       * blocklist content
       */
      readonly blocklist: BlocklistProvider;
    }

    export interface BlocklistUrlsKeyValueConfig extends IModuleConfig {
      /**
       * `block` - this mode blocks ad requests entirely
       * `key-value` - sets a specified key value
       */
      readonly mode: 'key-value';

      readonly blocklist: BlocklistProvider;

      /**
       * The key that is used for the key value
       */
      readonly key: string;

      /**
       * The value that is sent when a URL is listed.
       *
       * default is `true`
       */
      readonly isBlocklistedValue?: string;
    }
  }

  export namespace skin {
    export interface SkinModuleConfig extends IModuleConfig {
      /**
       * A list of configurations. The first configuration with matching
       * format filters will be used.
       */
      readonly configs: SkinConfig[];

      /**
       * Function to track when the skin cpm is lower than the combined cpm of the ad slots that
       * would be removed in its favour.
       */
      readonly trackSkinCpmLow?: (
        cpms: { skin: number; combinedNonSkinSlots: number },
        skinConfig: SkinConfig,
        skinBid: prebidjs.IBidResponse
      ) => void;
    }

    /**
     * If this filter is added to the list of filters, then it will always apply.
     * This filter is useful for "orchestration ad units" that don't serve ads, but
     * orchestrate a format. Examples are
     *
     * - `wallpaper_pixel`
     */
    export type AllFormatFilter = {
      readonly bidder: '*';
    };

    export type GumGumFormatFilter = {
      readonly bidder: typeof prebidjs.GumGum;

      /**
       * Stands for _ad id_ and contains the format delivered.
       *
       * - `59` = in-screen cascade (former mobile skin)
       * - `39` = in-screen expandable (mobile expandable)
       *
       * If not set, then the `auid` will not be considered for filtering.
       */
      readonly auid?: number;
    };

    /**
     * Azerion (fka Improve Digital) format filter
     */
    export type AzerionFormatFilter = {
      readonly bidder: typeof prebidjs.ImproveDigital;
    };

    export type DSPXFormatFilter = {
      readonly bidder: typeof prebidjs.DSPX;
    };

    export type VisxFormatFilter = {
      readonly bidder: typeof prebidjs.Visx;
    };

    /**
     * Partners buying skin demand via the Xandr platform
     */
    export type XandrFormatFilter = {
      readonly bidder: typeof prebidjs.AppNexusAst | typeof prebidjs.AppNexus;
    };

    /**
     * Partners buying skin demand via the Yieldlab platform
     */
    export type YieldlabFormatFilter = {
      readonly bidder: typeof prebidjs.Yieldlab;
    };

    export type FormatFilter =
      | AllFormatFilter
      | AzerionFormatFilter
      | GumGumFormatFilter
      | DSPXFormatFilter
      | VisxFormatFilter
      | YieldlabFormatFilter
      | XandrFormatFilter;

    export type SkinConfig = {
      /**
       * A list of filters. If one of the filter applies then this
       * configuration will be executed.
       */
      readonly formatFilter: FormatFilter[];

      /**
       * This is usually the dom id of the header ad slot.
       *
       * Some setups may have an ad slot only for the just premium skin.
       * This is the case if there are direct campaign formats for wallpapers
       * that require a DFP road block.
       */
      readonly skinAdSlotDomId: string;

      /**
       * dom ids of the ad slots that should not be requested when a just premium
       * skin appears in the bid responses.
       *
       * Depending on the wallpaperAdSlot these are usually skyscrapers left and right
       * and if there's a specific wallpaper ad slot the header as well.
       */
      readonly blockedAdSlotDomIds: string[];

      /**
       * if true, the ad slot will be set to display none
       */
      readonly hideSkinAdSlot: boolean;

      /**
       * if true, the blocked ad slots will be set to display: none
       */
      readonly hideBlockedSlots: boolean;

      /**
       * If the skin cpm comparison should be active, i.e. not only logging, but also preventing a skin render
       * if the other slots have a higher combined cpm.
       */
      readonly enableCpmComparison: boolean;

      /**
       * Selector for an (additional) ad slot container that should be set to display: none
       *
       * e.g. mobile-sticky ads have another container wrapped around the ad slot container itself which can be hidden like this:
       * hideBlockedSlotsSelector: '[data-ref="sticky-ad"]'
       */

      hideBlockedSlotsSelector?: string;

      /**
       * If set to true the ad slot that would load the skin is being destroyed.
       * This is useful only for ad slots that serve as a special "skin ad slot"
       * and have otherwise no other function.
       *
       * @default false
       */
      readonly destroySkinSlot?: boolean;

      /**
       * If set, the skin of the configured bidder reloads after the given interval (in ms).
       */
      readonly adReload?: { intervalMs: number; allowed: prebidjs.BidderCode[] };
    };
  }

  export namespace prebid_first_party_data {
    export type GptTargetingMapping = {
      /**
       * The `key` in the targeting map that contains the `cat` values.
       *
       * The targeting values should be an array of IAB content categories of the site.
       */
      readonly cat?: string;

      /**
       * The `key` in the targeting map that contains the `sectionCat` values.
       *
       * The targeting values should be an array of IAB content categories that describe the current section of the site.
       * If not defined, `cat` will be used as a fallback
       */
      readonly sectionCat?: string;

      /**
       * The `key` in the targeting map that contains the `pageCat` values.
       *
       * The targeting values should be an array of IAB content categories that describe the current page or view of
       * the site. if not defined, `cat` will be used as a fallback
       */
      readonly pageCat?: string;

      /**
       * The `key` in the targeting map that contains the `iabV2` segment values.
       *
       * The targeting values should be an array of IABV2 content category ids that describe the current page or view of
       * the site. if not defined, we'll not set the data object.
       */
      readonly iabV2?: string;

      /**
       * The `key` in the targeting map that contains the `iabV3` segment values.
       *
       * The targeting values should be an array of IABV3 content category ids that describe the current page or view of
       * the site. if not defined, we'll not set the data object.
       */
      readonly iabV3?: string;
    };

    export interface PrebidFirstPartyDataModuleConfig extends IModuleConfig {
      /**
       * A static OpenRTB2 config that is merged with the dynamic settings from
       * the key value targetings
       */
      readonly staticPrebidFirstPartyData?: prebidjs.firstpartydata.PrebidFirstPartyData;

      /**
       * static mapping definitions for relevant OpenRTB 2.5 properties from
       * gpt targetings.
       *
       * Use this to extract dynamic values set via `moli.setTargeting()`.
       */
      readonly gptTargetingMappings?: GptTargetingMapping;

      /**
       * Name of the provider that is used in the site.content.data segments as provider name.
       * Usually, this is the name/domain of the publisher.
       *
       * https://docs.prebid.org/features/firstPartyData.html#segments-and-taxonomy
       */
      readonly iabDataProviderName?: string;
    }
  }

  export namespace emetriq {
    export type EmetriqModuleConfig = EmetriqAppConfig | EmetriqWebConfig;

    export interface IEmetriqModuleConfig {
      readonly enabled?: boolean;
      /**
       * Defines a delay for the user-sync
       *
       * - `pbjs` (recommended)
       *    uses the prebid.js `auctionEnd` event to fire the user sync.
       * - `number`
       *    delay in `ms` before the script is loaded. Use this if prebid is not
       *    available
       *
       * @default if not set, there is no delay
       */
      readonly syncDelay?: SyncDelay;

      /**
       * Optional mapping definitions. Map values from the key-value targeting map
       * to a custom parameter that is sent to emetriq.
       */
      readonly customMappingDefinition?: EmetriqMappingDefinition[];

      /**
       * Optional configuration for login events
       * @see https://docs.xdn.emetriq.de/#event-import
       */
      readonly login?: EmetriqLoginEventConfig;
    }

    export interface EmetriqAppConfig extends IEmetriqModuleConfig {
      /**
       * inApp configuration
       * Required parameter for app tracking
       */
      readonly os: 'android' | 'ios';

      readonly sid: number;

      /**
       * App id of app store
       * @example `de.emetriq.exampleApp`
       */
      readonly appId: string;

      /**
       * At least one of the config properties `link` or `keywords` must be set.
       */
      readonly linkOrKeyword: EmetriqAppKeywordOrLinkConfig;

      /**
       * Key within the moli config keyValues in which the advertising id can be found.
       *
       * Used to infer the `device_id` parameter.
       * > `device_id`: Optional. Mobile identifier (IDFA or ADID). In lower case.
       * > This field can be omitted if it is not possible to obtain the identifier.
       */
      readonly advertiserIdKey: string;

      /**
       * Configure additional identifiers
       *
       * @see https://doc.emetriq.de/#/profiling/identifiers
       */
      readonly additionalIdentifier?: EmetriqAdditionalIdentifier;

      /**
       * Additional parameters (i.e. hardfacts), which could be provided from a partner. (i.e. `gender=frau&age=25`)
       *
       * @see https://doc.emetriq.de/#/inapp/integration
       */
      readonly customKeywords?: Omit<EmetriqParams, 'sid'>;
    }

    export interface EmetriqWebConfig extends IEmetriqModuleConfig {
      /**
       * specifies that the emetriq js should be loaded
       */
      readonly os: 'web';

      /**
       * Global parameter on window
       */
      readonly _enqAdpParam: EmetriqParams;
    }

    export type EmetriqAppKeywordOrLinkConfig =
      | {
          /** @see EmetriqAppKeywordOrLinkConfig docs */
          readonly link: string;
          /** @see EmetriqAppKeywordOrLinkConfig docs */
          readonly keywords: string;
        }
      | {
          /** @see EmetriqAppKeywordOrLinkConfig docs */
          readonly link: string;
          readonly keywords?: undefined;
        }
      | {
          readonly link?: undefined;
          /** @see EmetriqAppKeywordOrLinkConfig docs */
          readonly keywords: string;
        };

    export interface EmetriqLoginEventConfig {
      /**
       * This is a special ID assigned to the partner by emetriq.
       */
      readonly partner: string;

      /**
       * a `Base64` encoded `SHA-256` of user’s email address (in lower case and UTF-8 encoded). For event imports it is
       * necessary to URL encode it. See [Example GUID hashing](https://docs.xdn.emetriq.de/#hashing) for comparing your implementation with expected results.
       *
       * @see https://docs.xdn.emetriq.de/#hashing
       */
      readonly guid: string;
    }

    export type EmetriqMappingDefinition = {
      /**
       * custom parameter provided to emetriq
       */
      readonly param: EmetriqCustomParam;

      /**
       * key matching a key-value in the targeting object, that contains the param
       * value for emetriq.
       *
       * string arrays will be mapped to a single, comma separated string.
       *
       * If a key is not available in the targeting map, it will be ommited.
       */
      readonly key: string;
    };
  }

  export namespace identitylink {
    export interface IdentityLinkModuleConfig extends IModuleConfig {
      /**
       * The launchPadID references a bunch of services from LiveRamp that are
       * loaded dynamically.
       *
       * It is used to load the script from the LiveRamp CDN at https://launchpad-wrapper.privacymanager.io
       *
       * @example `f865e2a1-5e8f-4011-ae31-079cbb0b1d8e`
       * @see https://launch.liveramp.com/launchpad/[launchPadId]
       * @see https://launchpad-wrapper.privacymanager.io/[launchPadId]/launchpad-liveramp.js
       */
      readonly launchPadId: string;

      /**
       * md5, sha1, and sha256 hashes of the user's email address.
       *
       * From the docs
       *
       * > While the ATS script only needs one hash to create the envelope, we highly recommend providing the ATS Library with
       * > all three email hash types to get the best match rate. If you are only able to provide one hash, use SHA256 for
       * > EU/EAA and SHA1 for U.S.
       *
       * Ordering seems important.
       *
       * - "EMAIL_HASH_SHA1",
       * - "EMAIL_HASH_SHA256",
       * - "EMAIL_HASH_MD5"
       */
      readonly hashedEmailAddresses: string[];
    }
  }

  export namespace yield_optimization {
    export type YieldOptimizationConfigProvider = 'none' | 'static' | 'dynamic';

    /**
     * Available options to configure yield optimization
     */
    export type YieldOptimizationConfig =
      | NoYieldOptimizationConfig
      | StaticYieldOptimizationConfig
      | DynamicYieldOptimizationConfig;

    export type IYieldOptimizationConfig = IModuleConfig & {
      readonly provider: YieldOptimizationConfigProvider;
    };

    /**
     * No key values will be applied. The system is inactive.
     */
    export type NoYieldOptimizationConfig = IYieldOptimizationConfig & {
      readonly provider: 'none';
    };

    /**
     * A static configuration for all ad units. This is to emulate server requests
     */
    export type StaticYieldOptimizationConfig = IYieldOptimizationConfig & {
      readonly provider: 'static';

      readonly config: AdunitPriceRulesResponse;
    };

    /**
     * A dynamic configuration
     */
    export type DynamicYieldOptimizationConfig = IYieldOptimizationConfig & {
      readonly provider: 'dynamic';

      /**
       * URL to a json config file that contains a list of AdUnitPriceRules.
       */
      readonly configEndpoint: string;

      /**
       * AdUnitPaths that don't need the yield optimization. Add all adUnits that are not configured in the server.
       */
      readonly excludedAdUnitPaths: string[];
    };

    export type PriceRules = {
      /**
       * The ad unit that is being configured along with a price that was selected from the server
       */
      readonly [adUnitPath: string]: MoliRuntime.yield_optimization.PriceRule;
    };

    /**
     * Response from the yield optimization server
     */
    export type AdunitPriceRulesResponse = {
      readonly rules: PriceRules;
      /**
       * the browser that was detected on the backend.
       * @example Chrome
       */
      readonly browser?: string;
    };
  }

  export interface ModulesConfig {
    readonly adReload?: adreload.AdReloadModuleConfig;
    readonly cleanup?: cleanup.CleanupModuleConfig;
    readonly pubstack?: pubstack.PubstackConfig;
    readonly confiant?: confiant.ConfiantConfig;
    readonly blocklist?:
      | blocklist.BlocklistUrlsBlockingConfig
      | blocklist.BlocklistUrlsKeyValueConfig;
    readonly adex?: adex.AdexConfig;
    readonly skin?: skin.SkinModuleConfig;
    readonly prebidFirstPartyData?: prebid_first_party_data.PrebidFirstPartyDataModuleConfig;
    readonly yieldOptimization?: yield_optimization.YieldOptimizationConfig;
    readonly emetriq?: emetriq.EmetriqModuleConfig;
    readonly identitylink?: identitylink.IdentityLinkModuleConfig;
  }
}

/**
 * ## Moli Configuration
 *
 * Contains the configuration for the ad tag that is served from a backend.
 */
export interface MoliConfig {
  /**
   * The version of the ad tag. This is used to identify the version of the ad tag
   * that is served to the client. This is useful for debugging purposes.
   */
  readonly version?: string;

  /**
   * default is `gam`
   */
  readonly adServer?: AdServer;

  /**
   * Set the domain on which this ad tag runs. This should be the "top private domain", which is the `subdomain` + `public prefix`.
   * The notion "top private domain" comes from the Google Guava library.
   *
   * In general, it's recommended to set the domain in the ad tag configuration. As a fallback, the ad tag tries to
   * extract the top private domain, but with a very limited implementation. This also fails if the ad tag is called
   * on other domains such as google.transl or in iframe integrations.
   *
   * ## Ad Unit Path Variables
   *
   * The `domain` will be used in the `adUnitPathVariables`. A domain set via `setAdUnitPathVariables` takes precedences over
   * the ad tag config. If neither `domain` is set in the config, nor provided via `setAdUnitPathVariables`, we make a best
   * effort guess via `window.location.hostname`.
   *
   * ## Label
   *
   * If set, the `domain` will also be added as a label.
   *
   * ## Why ?
   *
   * The `domain` is part of the ad unit path and used for targeting certain bidders that work on a per-domain basis.
   *
   * ## Examples
   *
   * - `example.com` - the most common domain
   * - `example.co.uk` - some country TLDs span the last two segments
   * - `myblog.github.io` - github.io is a public suffix and subdomains are separate domains
   * - `my-sub-domain.my-domain.com` - my domain is not in the publc_suffix_list.dat , but I still use subdomains for different sites
   *
   * @see https://www.npmjs.com/package/parse-domain npm package for root domain parsing
   * @see https://publicsuffix.org/list/public_suffix_list.dat a list of all public suffixes
   * @see https://github.com/google/guava/wiki/InternetDomainNameExplained detailed explanation for TLD, public suffix and registry suffix
   */
  readonly domain?: string;

  /** all possible ad slots */
  readonly slots: AdSlot[];

  /**
   * Optional configuration for single page
   */
  readonly spa?: SinglePageAppConfig;

  /** supply chain object */
  readonly schain: schain.SupplyChainConfig;

  /** optional key-value targeting for DFP */
  targeting?: Targeting;

  /**
   * Label configuration to support "responsive" ads.
   * This is an alternative solution to custom () => DfpSlotSize[] functions and is taken
   * from prebid.js.
   *
   * https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
   */
  labelSizeConfig?: LabelSizeConfigEntry[];

  readonly consent?: consent.ConsentConfig;

  /** optional prebid configuration */
  readonly prebid?: headerbidding.PrebidConfig;

  /** Amazon A9 headerbidding configuration */
  readonly a9?: headerbidding.A9Config;

  /**
   * Configure optimization through the global auction context
   */
  readonly globalAuctionContext?: auction.GlobalAuctionContextConfig;

  /**
   * ## Module configuration
   *
   * Optional module configuration. Every module must be enabled individually and has its own configuration.
   * A module may the access its configuration via the `moli` configuration. This is very similar to how prebid handles
   * module configuration.
   */
  readonly modules?: modules.ModulesConfig;

  /**
   * Configure bucketing behaviour
   */
  readonly buckets?: bucket.GlobalBucketConfig;
}
