import { prebidjs } from './prebidjs';
import { SupplyChainObject } from './supplyChainObject';
import { apstag } from './apstag';

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
  [key: string]: string;
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
  adUnitPathVariables?: AdUnitPathVariables;
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
  readonly passbackSupport?: Boolean;
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
  readonly jsAsString: string;
}

export interface CleanupConfig {
  /**
   * The bidder that offers the special format.
   */
  readonly bidder: string;
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
  export interface CleanupModuleConfig {
    /**
     * Information about whether the cleanup module is enabled or not.
     */
    readonly enabled: boolean;
    /**
     * A list of configurations.
     */
    readonly configs: CleanupConfig[];
  }

  export interface ModulesConfig {
    readonly cleanup?: CleanupModuleConfig;
  }
}

/**
 * ## Moli Configuration
 *
 * Contains the configuration for the ad tag that is served from a backend.
 */
export interface MoliConfig {
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
