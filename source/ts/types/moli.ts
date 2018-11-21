import { googletag } from './googletag';
import { prebidjs } from './prebidjs';

/* tslint:disable:interface-name */
export namespace Moli {

  export type DfpSlotSize = [number, number] | 'fluid';

  /**
   * KeyValue map. Last insert wins.
   */
  export interface DfpKeyValueMap {
    [key: string]: string | string[] | undefined;
  }

  export type MoliCommand = (moli: MoliTag) => void;

  export interface MoliTag {

    /**
     * Queue for async loading and processing
     */
    que: {
      /**
       * Push a single command into the queue.
       *
       * @param cmd
       */
      push(cmd: MoliCommand): void;
    };


    /**
     * Set a key value. Can be used in DFP or prebid bids configuration.
     * @param key
     * @param value
     */
    setTargeting(key: string, value: string | string[]): void;

    /**
     * Adds a label to the static label list.
     * @param label to be added
     */
    addLabel(label: String): void;

    /**
     * Set a custom logger that should be used for logging.
     *
     * @param logger
     */
    setLogger(logger: MoliLogger): void;

    /**
     *
     * @param config the ad configuration
     * @returns a promise which resolves when the content of all eagerly initialized slots are loaded
     */
    configure(config: MoliConfig): void;


    /**
     * Start requesting ads as soon as the tag has been configured.
     */
    requestAds(): Promise<state.IConfigurable | state.IFinished | state.IError>;

    /**
     * @returns the configuration used to initialize the ads. If not yet initialized, undefined.
     */
    getConfig(): MoliConfig | undefined;

    /**
     * @returns the current state name
     */
    getState(): state.States;

    /**
     * Request the debug bundle and start the debug mode.
     */
    openConsole(): void;
  }

  /**
   *
   * ## State transitions
   *
   * The state machine is defined as:
   *
   * <pre style="font-size:10px;">
   *                                                                                        ads ok        +----------+
   *                                                                                                      |          |
   *                                                                                     +------------>   | finished |
   *                                                                                     |                |          |
   *                                                                                     |                +----------+
   * +--------------+    configure(config)   +------------+      requestAds()     +------+-----+
   * |              |                        |            |                       |            |
   * | configurable |  +-------------------> | configured |  +----------------->  | requestAds |
   * |              |                        |            |                       |            |
   * +--------------+                        +------------+                       +------+-----+
   *                                                                                     |                +----------+
   *   +         ^                            +         ^                                |                |          |
   *   |         |                            |         |                                +------------->  | error    |
   *   +  setXYZ +                            +  setXYZ +                                                 |          |
   *      addXYZ                                 addXYZ                                     ads not ok    +----------+
   * </pre>
   *
   * Each state has allowed operations and transitions
   *
   * ### Configurable state
   *
   * In this state the ad tag can be customized. All `getXYZ` and `addXYZ` methods
   * can be called.
   *
   *
   * * `addXYZ` - with transition `configurable -> configurable`
   * * `setXYZ` - with transition `configurable -> configurable`
   * * `configure` - with transition `configurable ->  configured`
   *    Sets the main configuration. Changes can still be made.
   * * `requestAds` - with transition `configurable -> configurable`
   *   After `moli.configure` has been called, ads will be requested immediately.
   *
   * ### Configured state
   *
   * The main ad configuration has been set. `moli.getConfig` now returns the current
   * configuration.
   *
   * * `addXYZ` - with transition `configured -> configured`
   * * `setXYZ` - with transition `configured -> configured`
   * * `requestAds` - with transition `configured -> requestAds`.
   *   No changes are allowed anymore
   *
   *
   * ### RequestAds state
   *
   * No changes are allowed anymore. The configuration is frozen. All `addXYZ` and `setXYZ`
   * calls will fail.
   *
   * Two state transitions will happen:
   *
   * 1. After all ads have been loaded successfully: `requestAds -> finished`
   * 1. After an error during ad loading: `requestAds -> error`
   *
   *
   * ### Finished state
   *
   * All ads have been successfully loaded.
   *
   * ### Error state
   *
   * An error occurred while were being loaded.
   *
   */
  export namespace state {

    export type States = 'configurable' | 'configured' | 'requestAds' | 'finished' | 'error';

    /**
     * Base interface for all states.
     */
    export interface IState {
      readonly state: States;
    }

    export interface IConfigurable extends IState {
      readonly state: 'configurable';


      // changeable configuration options

      /**
       * If set to true, initializes the ad tag as soon as the ad configuration has been set.
       * If set to false, nothing will initialize until moli.initialize is called
       */
      initialize: boolean;

      /**
       * Additional key-values. Insert with
       *
       * @example
       * window.moli.que.push(function(moli) => {
       *   moli.setTargeting(key, value);
       * });
       *
       */
      keyValues: Moli.DfpKeyValueMap;

      /**
       * Additional labels. Insert with
       *
       * @example
       * window.moli.que.push(function(moli) => {
       *   moli.addLabel('foo');
       * });
       */
      labels: string[];

      /**
       * Custom logger
       */
      logger?: MoliLogger;

    }

    /**
     * The ad configuration has been set
     */
    export interface IConfigured extends IState {
      readonly state: 'configured';

      /**
       * Changeable configuration if other settings have been pushed into the que.
       */
      config: Moli.MoliConfig;
    }

    /**
     * Moli should be initialized. This can only be done from the "configured" state.
     *
     * If moli is in the "configurable" state, the `initialize` flag will be set to true
     * and moli is initialized once it's configured.
     */
    export interface IRequestAds extends IState {
      readonly state: 'requestAds';

      /**
       * Configuration is now immutable
       */
      readonly config: Moli.MoliConfig;
    }

    /**
     * Moli has finished loading.
     */
    export interface IFinished extends IState {
      readonly state: 'finished';

      /**
       * Configuration is now immutable
       */
      readonly config: Moli.MoliConfig;
    }

    /**
     * Moli has finished loading.
     */
    export interface IError extends IState {
      readonly state: 'error';

      /**
       * Configuration is now immutable
       */
      readonly config: Moli.MoliConfig;

      /**
       * the error. Should  be readable for a key accounter and a techi.
       */
      readonly error: any;
    }

    /**
     * All valid states
     */
    export type IStateMachine = IConfigurable | IConfigured | IRequestAds | IFinished | IError;
  }

  export interface MoliConfig {

    /** all possible ad slots */
    readonly slots: AdSlot[];

    /** optional key-value targeting for DFP */
    readonly targeting?: {

      /** static or supplied key-values */
      readonly keyValues: DfpKeyValueMap;

      /** additional labels. Added in addition to the ones created by the sizeConfig. */
      readonly labels?: string[];
    };

    /**
     * Size configuration to support "responsive" ads.
     * This is an alternative solution to custom () => DfpSlotSize[] functions and is taken
     * from prebid.js.
     *
     * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly sizeConfig?: SizeConfigEntry[];

    /** optional prebid configuration */
    readonly prebid?: headerbidding.PrebidConfig;

    /** Amazon A9 headerbidding configuration */
    readonly a9?: headerbidding.A9Config;

    /**
     * GDPR consent management settings
     */
    readonly consent: consent.ConsentConfig;

    /**
     * Reporting configuration
     */
    readonly reporting?: reporting.ReportingConfig;

    /** configurable logger */
    readonly logger?: MoliLogger;

  }

  /**
   * Configure sizes and labels based on media queries.
   *
   * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
   * http://prebid.org/dev-docs/conditional-ad-units.html
   */
  export interface SizeConfigEntry {
    /** media query that must match if the sizes are applicable */
    readonly mediaQuery: string;

    /** static sizes that are support if the media query matches */
    readonly sizesSupported: DfpSlotSize[];

    /** labels that are available if the media query matches */
    readonly labels: string[];
  }

  export interface IAdSlot {
    /** id for the ad slot element */
    readonly domId: string;

    /** dfp adUnit path for this slot */
    readonly adUnitPath: string;

    /** the sizes for this ad slot */
    readonly sizes: DfpSlotSize[];

    /** is this a dfp out-of-page (interstitial) slot or not */
    readonly position: 'in-page' | 'out-of-page';

    /** configure how and when the slot should be loaded */
    readonly behaviour: behaviour.SlotLoading;

    /**
     * Conditionally select the ad unit based on labels.
     * Labels are supplied by the sizeConfig object in the top level moli configuration.
     *
     * The API and behaviour matches the prebid API.
     * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     * http://prebid.org/dev-docs/conditional-ad-units.html
     */
    readonly labelAny?: string[];
    readonly labelAll?: string[];

    /** an optional prebid configuration if this ad slot can also be used by prebid SSPs */
    readonly prebid?: headerbidding.PrebidAdSlotConfigProvider;

    /** optional a9 configuration if this ad slot can also be used by a9 */
    readonly a9?: headerbidding.A9AdSlotConfig;
  }

  // -----------------------------------------
  // ------- Ad Slot definitions -------------
  // -----------------------------------------

  /**
   * An ad slot which is requested during page load.
   * This is the standard behaviour.
   */
  export interface EagerAdSlot extends IAdSlot {
    readonly behaviour: 'eager';
  }

  /**
   * An ad slot which is requested lazily.
   * DFP offers a similar implementation, but only for "load when in view port"
   */
  export interface LazyAdSlot extends IAdSlot {
    readonly behaviour: 'lazy';

    /** what triggers the loading */
    readonly trigger: behaviour.Trigger;
  }

  /**
   * An ad slot which can be refreshed.
   * Useful for
   * - sorting lists that contain ads
   * - Single page applications (SPA)
   */
  export interface RefreshableAdSlot extends IAdSlot {
    readonly behaviour: 'refreshable';

    /** what triggers the refresh */
    readonly trigger: behaviour.Trigger;
  }

  /**
   * An ad slot that should request prebid SSPs.
   */
  export interface PrebidAdSlot extends IAdSlot {
    readonly prebid: headerbidding.PrebidAdSlotConfigProvider;
  }

  /**
   * An ad slot that should request a9 bids.
   */
  export interface A9AdSlot extends IAdSlot {
    readonly a9: headerbidding.A9AdSlotConfig;
  }

  /**
   * AdSlot type
   *
   * Used for discriminating unions to make type safe assumptions about the existence
   * or type of individual properties.
   */
  export type AdSlot = EagerAdSlot | LazyAdSlot | RefreshableAdSlot | PrebidAdSlot | A9AdSlot;

  /**
   * Combines the moli slot configuration (`Moli.AdSlot`) along with the actual `googletag.IAdSlot` definition.
   *
   * This model lets you work with the materialized slot (`googletag.IAdSlot`), while having access to the
   * configuration settings from the `Moli.AdSlot` definition.
   */
  export interface SlotDefinition<S extends Moli.AdSlot> {
    /** The moli adSlot configuration */
    readonly moliSlot: S;

    /** The actual dfp slot returned by `googletag.defineSlot` or `googletag.defineOutOfPageSlot` */
    readonly adSlot: googletag.IAdSlot;
  }

  /** slot behaviour namespace */
  export namespace behaviour {

    export type SlotLoading = 'eager' | 'lazy' | 'refreshable';

    /** all available triggers for loading behaviours */
    export type Trigger = EventTrigger;

    /**
     * Triggers when a certain event is fired via `window.dispatchEvent`.
     */
    export interface EventTrigger {
      readonly name: 'event';

      /** the event name */
      readonly event: string;
    }

  }

  /** header bidding types */
  export namespace headerbidding {

    /**
     * A `PrebidAdSlotConfig` can either be created
     *
     * - as a static value
     * - from a function which takes a `PrebidAdSlotContext`
     */
    export type PrebidAdSlotConfigProvider = PrebidAdSlotConfig | ((context: PrebidAdSlotContext) => PrebidAdSlotConfig);

    /**
     * Context for creating a dynamic `PrebidAdSlotConfig`. Grants access to certain values
     * from the `MoliConfig` to configure prebid bidder params.
     *
     * **Use cases**
     *
     * * key-value targeting in prebid params
     *
     */
    export interface PrebidAdSlotContext {

      /**
       * Access key-values
       */
      readonly keyValues: DfpKeyValueMap;
    }

    /**
     * Object with additional listeners to customize the prebid behaviour.
     *
     * ## `preSetTargetingForGPTAsync` listener
     *
     * Allow to react during the `bidsBackHandler` is being called and add
     * additional behaviour before the DFP key values have been set.
     *
     * **Use case**
     *
     * Special formats like the wallpaper/skin ad from just premium may require
     * removing other ad slots.
     *
     * @example
     * const prebidListener = {
     *   preSetTargetingForGPTAsync: (bidResponses: prebidjs.IBidResponsesMap, timedOut: boolean, slotDefinitions: SlotDefinition<AdSlot>[]) => {
     *     if (this.checkForJustPremiumWallpaper(bidResponses)) {
     *       // finds the googletag.AdSlot and calls googletag.destroySlots([skyScraperSlot]);
     *       this.destroySkyscraperAdUnit(slotDefinitions);
     *     }
     *   }
     * }
     *
     */
    export interface PrebidListener {

      /** called in the `bidsBackHandler` before the dfp key-values are being set */
      readonly preSetTargetingForGPTAsync?: (bidResponses: prebidjs.IBidResponsesMap, timedOut: boolean, slotDefinitions: SlotDefinition<AdSlot>[]) => void;
    }

    export interface PrebidConfig {
      /** http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
      readonly config: prebidjs.IPrebidJsConfig;

      /** optional bidder settings */
      readonly bidderSettings?: prebidjs.IBidderSettings;

      /** optional listener for prebid events */
      readonly listener?: PrebidListener;
    }

    /**
     * Configuration for a prebid enabled ad slot
     */
    export interface PrebidAdSlotConfig {
      /**
       * bids configuration
       *
       * http://prebid.org/dev-docs/publisher-api-reference.html#addAdUnits-AdUnitProperties
       */
      readonly adUnit: prebidjs.IAdUnit;
    }

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
    }

    /**
     * See internal A9 apstag documentation
     */
    export interface A9AdSlotConfig {}
  }

  /**
   * ## Consent Management
   *
   * GDPR compliant consent management configuration.
   *
   */
  export namespace consent {

    /**
     * Top level consent management configuration.
     */
    export interface ConsentConfig {

      /** DFP `setNonPersonalizedAds` configuration provider */
      readonly personalizedAds: consent.PersonalizedAdsProvider;
    }

    /**
     * Union type for the different dfp `setNonPersonalizedAds` implementations.
     */
    export type PersonalizedAdsProvider = Static | Cmp | Cookie;

    /**
     * Base interface for personalizedAds implementations.
     */
    export interface IPersonalizedAdsProvider {
      provider: 'static' | 'cmp' | 'cookie';
    }

    /**
     * ## Static
     *
     * Configures a fixed value for the `setNonPersonalizedAds` call.
     *
     * @example
     * {
     *   provider: 'static',
     *   value: 0
     * }
     *
     * Translates to `googletag.setNonPersonalizedAds(0)` which results in **personalized** ads.
     *
     *
     */
    export interface Static extends IPersonalizedAdsProvider {
      provider: 'static';
      value: 0 | 1;
    }

    /**
     * ## CMP - Consent Management Platform
     *
     * Uses the IAB `window.__cmp` API to check if consent has been given for all relevant
     * purposes.
     *
     * **RECOMMENDED**
     * This is the recommended implementation as it is fully IAB and GDPR compliant and
     * gives the publisher various options on how to handle the consent management.
     *
     *
     * ## CMP Providers
     *
     * A list of providers that work well with this approach.
     *
     * - Faktor.io
     */
    export interface Cmp extends IPersonalizedAdsProvider {
      provider: 'cmp';
    }

    /**
     * ## Cookie
     *
     * Configure a cookie that is checked for a specific value.
     *
     * **Note**
     * The implementation favors the _legitimate interest_ approach, which means that
     * if no cookie is set, consent is assumed. If the cookie is set, then the value
     * must match.
     *
     *
     * @example
     * {
     *   provider: 'cookie',
     *   cookie: '_sp_enable_dfp_personalized_ads',
     *   valueForNonPersonalizedAds: 'false'
     * }
     *
     * If a cookie `_sp_enable_dfp_personalized_ads` is available and set to `false`, then
     *
     * ```
     * googletag.setNonPersonalizedAds(1)
     * ```
     *
     * is being called. Otherwise
     *
     * ```
     * googletag.setNonPersonalizedAds(0)
     * ```
     *
     *
     * ## CMP Providers
     *
     * A list of providers that work well with this approach.
     *
     * - Sourcepoint
     *
     */
    export interface Cookie extends IPersonalizedAdsProvider {
      provider: 'cookie';

      /**
       * The cookie name to look for.
       */
      cookie: string;

      /**
       * if cookie exists and contains this value, nonPersonalizedAds will be displayed.
       */
      valueForNonPersonalizedAds: string;
    }

  }

  /**
   * ## Reporting
   *
   * Moli provides extension points to add listeners for different metrics. These can
   * be used to measure performance and latency of your ad setup.
   *
   * ## Metrics
   *
   * All metrics are based on the Web Performance API. If a browser doesn't support this
   * API, no metrics will be collected.
   *
   * Moli provides the following metrics
   *
   * * `dfpLoad`    - measurement from `requestAds` to `finish`
   * * `prebidLoad` - measurement from `requestBids` to `bidsBackHandler` called
   * * `ttfa`       - Time-To-First-Ad measurement from `requestAds` to the first ad slot render call
   * * `ttfr`       - Time-To-FIrst-Render measurement from `requestAds` to first ad slot fully rendered
   * * `adslot`     - Contains multiple metrics for a single ad slot. See `AdSlotMetric` for more details.
   *
   * @see https://developer.mozilla.org/de/docs/Web/API/Performance
   *
   */
  export namespace reporting {

    /**
     * Reporting configuration
     */
    export interface ReportingConfig {

      /**
       * a value between 0 and 1 to define the percentage of page requests that should be used
       * to report metrics.
       *
       * @example
       * sampleRate = 1   // 100%
       * sampleRate = 0.5 //  50%
       * sampleRate = 0   //   0%
       */
      readonly sampleRate: number;

      /**
       * A list of reporters
       */
      readonly reporters: Reporter[];

      /**
       * An optional regex for shortening the adunit name in the performance marks and measures.
       * By default the publisher id is removed and nothing else.
       *
       * @example
       * adUnitRegex = undefined;
       * "/1234/my/ad/unit" => "my/ad/unit"
       *
       */
      readonly adUnitRegex?: string | RegExp;

    }

    /**
     * A reporter is a simple function that receives a metric and handles it.
     */
    export type Reporter = (metric: Metric) => void;


    /**
     * Union type for all provided metric types.
     */
    export type MetricType = 'dfpLoad' | 'prebidLoad' | 'ttfa' | 'ttfr' | 'adSlot' | 'adSlots';

    /**
     * Base interface for all provided metrics.
     */
    export interface IMetric {
      readonly type: MetricType;

      /**
       * Unique identifier to identify ad slots that have been requested during the
       * same page request.
       */
      readonly pageRequestId: string;
    }

    /**
     * Base type for all provided metrics.
     */
    export type Metric = SingleMeasurementMetric | AdSlotMetric | AdSlotsMetric;

    /**
     * The single measure metric represents all metrics with only one measure.
     */
    export interface SingleMeasurementMetric extends IMetric {

      /**
       * All metrics that provide only a single measurement point.
       */
      readonly type: 'dfpLoad' | 'prebidLoad' | 'ttfa' | 'ttfr';

      /**
       * The measurement provided by the metric `type`
       */
      readonly measurement: PerformanceMeasure;
    }

    /**
     * The ad slots metric represents aggregated metrics for all ad slots on the site.
     */
    export interface AdSlotsMetric {

      readonly type: 'adSlots';

      /**
       * The total number of ad slots on the page that were rendered.
       */
      readonly numberAdSlots: number;

      /**
       * The number of ad slots that weren't rendered, because no creative was delivered.
       */
      readonly numberEmptyAdSlots: number;

    }

    /**
     * AdSlot metric type. Fired for each ad slot that is not empty.
     *
     * ## Dimensions
     *
     * The AdSlot metric contains a number of dimensions to enable fine grained analytics.
     *
     * - `pageRequestId` - allows an analytics backend to group all ad slots from a single page request together
     * - `adUnitName`    - the ad unit path to separate the different ad slots
     * - `advertiserId`  - the advertiser that filled this ad slot
     * - `campaignId`    - the order that filled this ad slot
     * - `lineItemId`    - the line item that filled this ad slot
     *
     * ## Metrics
     *
     * - `rendered` - ad slot is starting to render
     * - `loaded`   - ad slot is fully loaded
     *
     */
    export interface AdSlotMetric extends IMetric {

      readonly type: 'adSlot';


      /**
       * The adslot ad unit name/path.
       */
      readonly adUnitName: string;

      /**
       * Advertiser ID of the rendered ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/<publisherId>#admin/companyDetail/id=<advertiserId>
       */
      readonly advertiserId?: number;

      /**
       * Campaign ID (Order ID) of the rendered ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/<publisherId>#delivery/OrderDetail/orderId=<campaignId>
       */
      readonly campaignId?: number;

      /**
       * Line item ID of the rendered reservation ad. Value is null for empty slots, backfill ads or creatives rendered
       * by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/<publisherId>#delivery/LineItemDetail/orderId=<campaignId>&lineItemId=<lineItemId>
       */
      readonly lineItemId?: number;

      /**
       * Performance mark when the ad slot is refreshed.
       */
      readonly refresh: PerformanceMark;

      /**
       * Performance measure from `requestAds` until the adslot is rendered.
       */
      readonly rendered: PerformanceMeasure;

      /**
       * Performance measure from `requestAds` until the adslot is fully loaded.
       */
      readonly loaded: PerformanceMeasure;

      /**
       * Performance measure from `adSlot rendered` to `adSlot loaded`. This give
       * represents the time the creative needed to be fully visible.
       */
      readonly rendering: PerformanceMeasure;

    }

  }


  /**
   * == Logger interface ==
   *
   * The default logging implementation uses `window.console` as the output.
   * Publishers may plugin their own logging implementation.
   *
   */
  export interface MoliLogger {

    /**
     * Log a debug message
     *
     * @param message
     * @param optionalParams - effect depends on the implementation
     */
    debug(message?: any, ...optionalParams: any[]): void;

    /**
     * Log a info message
     *
     * @param message
     * @param optionalParams - effect depends on the implementation
     */
    info(message?: any, ...optionalParams: any[]): void;

    /**
     * Log a warning
     *
     * @param message
     * @param optionalParams - effect depends on the implementation
     */
    warn(message?: any, ...optionalParams: any[]): void;

    /**
     * Log an error
     *
     * @param message
     * @param optionalParams - effect depends on the implementation
     */
    error(message?: any, ...optionalParams: any[]): void;

  }

}

declare global {

  /**
   * Add moli to the global Window instance
   */
  interface Window {

    /**
     * the global moli tag definition
     */
    moli: Moli.MoliTag;
  }
}

/* tslint:enable:interface-name */
