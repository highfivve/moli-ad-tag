import { googletag } from './googletag';
import { prebidjs } from './prebidjs';

/* tslint:disable:interface-name */
export namespace Moli {

  export type DfpSlotSize = [ number, number ] | 'fluid';

  /**
   * KeyValue map. Last insert wins.
   */
  export interface DfpKeyValueMap {
    [key: string]: string | string[] | undefined;
  }

  export type MoliCommand = (moli: MoliTag) => void;

  /**
   * # Moli Ad Tag
   *
   * This defines the publisher facing API. When the ad tag is configured in _publisher mode_, which means it doesn't fire
   * `requestAds()` immedetialy after being loaded, publishers can customize the integration.
   *
   *
   * ## Usage
   *
   * The general usage pattern is like `gpt` or `prebid`. If the ad tag is not yet available, commands can be pushed to
   * a que that will eventually be processed.
   *
   * @example minimal example on how to request ads <br><br>
   *
   * ```
   * window.moli = window.moli || { que: [] };
   * window.moli.que.push(function(moliAdTag) {
   *   moliAdTag.requestAds()
   * });
   * ```
   *
   * @see [[state]] module for more information on how molis internal flow works
   * @see [[behaviour]] module for more information on slot loading behaviour
   * @see [[consent]] module for more information on GDPR / DSVGO configuration options
   * @see [[reporting]] module for more information on how access metrics provided by moli
   * @see [[MoliLogger]] on how to configure your own logging with moli
   *
   */
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
     * @see [[MoliLogger]]
     */
    setLogger(logger: MoliLogger): void;

    /**
     * Configure the reporting sample rate
     *
     * @param samplingRate a number between 0 and 1
     */
    setSampleRate(samplingRate: number): void;

    /**
     * Add a reporter
     *
     * @param reporter the reporter function
     * @see [[reporting]] module for more information on how access metrics provided by moli
     */
    addReporter(reporter: Moli.reporting.Reporter): void;

    /**
     * Set the beforeRequestAds hook, which is triggered before the ads are being requested
     * with the final [[Moli.MoliConfig]].
     *
     * @param callback
     */
    beforeRequestAds(callback: (config: Moli.MoliConfig) => void): void;

    /**
     * Set the afterConsentAcquired hook, which is triggered after the check if the consent exists.
     * @param callback
     */
    afterConsentAcquired(callback: () => void): void;

    /**
     * **WARNING**
     * This method is called by the ad tag and can only be called once. If the publisher calls
     * calls `configure` then the ad configuration provided by the ad tag may not be used.
     *
     *
     * @param config the ad configuration
     * @returns a promise which resolves when the content of all eagerly initialized slots are loaded
     */
    configure(config: MoliConfig): void;

    /**
     * Enable the single page application mode.
     *
     * ## Usage
     *
     * If you enable the `Single Page App` mode, moli allows you to call `moli.requestAds()` multiple times.
     * This will
     *
     * - Remove all previous ad slots
     * - Trigger the full requestAds cycle meaning that
     *   - all slots will be checked for availability
     *   - prebid ad units will be configured
     *
     * It's publishers responsibility to trigger the `requestAds()` method whenever necessary. Usually the
     * javascript SPA framework has a proper routing API that enables you to fire events on arbitrary routing
     * events. Make sure that the `DOM` is fully materialized so the ad tag can find the ad slots.
     *
     * We recommend using the moli que to issue commands to moli due to the asynchronous nature. A minimal,
     * vanilla javascript example would look like this:
     *
     * @example On navigation change execute <br><br>
     * ```
     * window.moli = window.moli || { que: [] };
     * window.moli.que.push(function(moliAdTag) {
     *   moliAdTag.requestAds()
     * });
     * ```
     *
     *
     * ## Unsupported Features
     *
     * The single page application mode doesn't support all features that are provided by the static website mode.
     *
     * - `lazy` and `refreshable` slot loading behaviour is not support. This is due to the fact that we need to
     *    cleanup all the event listeners initialized by these slots on each `requestAds` call. This may come in
     *    later versions.
     *
     * - `targeting` and `labels` on page changes. This means that the initial targetings and labels you pushed
     *    into moli with `addLabel(label)` and `setTargeting(key, value)` will be set for the entire lifetime of
     *    the page.
     *    Note that the dynamic size configuration will be evaluated on each `requestAds()`
     *
     *
     */
    enableSinglePageApp(): void;


    /**
     * Start requesting ads as soon as the tag has been configured.
     *
     * The behaviour differs if `enableSinglePageApp()` has been called.
     * @see [[enableSinglePageApp]]
     */
    requestAds(): Promise<state.IConfigurable | state.ISinglePageApp | state.IFinished | state.IError>;

    /**
     * Returns the  current state of the configuration. This configuration may not be final!
     * If you need to access the final configuration use the `beforeRequestAds` method to configure
     * a callback.
     *
     *
     * @returns the configuration used to initialize the ads. If not yet initialized, undefined.
     * @see [[beforeRequestAds]]
     */
    getConfig(): MoliConfig | undefined;

    /**
     * @returns the current state name
     */
    getState(): state.States;

    /**
     * Open the moli debug console.
     *
     * @param path [optional] full path to the moli debug script.
     * Request the debug bundle and start the debug mode.
     */
    openConsole(path?: string): void;
  }

  /**
   *
   * ## State transitions
   *
   * The state machine is defined as:
   *
   * <pre style="font-size:10px;">
   *                                                                                   requestAds()
   *
   *                                                                                   +----------+
   *                                                                                   |          |
   *                                                                                   |          |
   *                                                                                   |          v
   *                                                                                   |
   *                                         +------------+     requestAds()     +-----+------------------+
   *                                         |            |                      |                        |
   *                                         | configured |  +---------------->  | Single Page App (spa)  |
   *                                         |            |                      |                        |
   *                                         +------------+                      +------------------------+
   *
   *                                               ^
   *                                               |
   *                                               |  enableSinglePageApp()
   *                                               |                                        ads ok        +----------+
   *                                               |                                                      |          |
   *                                               |                                     +------------>   | finished |
   *                                               +                                     |                |          |
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
   *
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
   * ### Single Page App state
   *
   * No changes are allowed anymore. The configuration is frozen. All `addXYZ` and `setXYZ`
   * calls will fail. This restriction may be lifted in future versions.
   *
   * Only called allowed is `requestAds()`, which refreshes the current ads and transitions
   * into the `Single Page App` state effectively staying in the same state.
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

    export type States = 'configurable' | 'configured' | 'spa' | 'requestAds' | 'finished' | 'error';

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
       * If set to true the `requestAds()` call will keep the app in the [[ISinglePageApp]]
       * If set to false the `requestAds() call will transition the state to [[IRequestAds]]
       */
      isSinglePageApp: boolean;

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

      /**
       * Customizable reporting configuration
       */
      reporting: {
        sampleRate?: number;

        reporters: Moli.reporting.Reporter[];
      };

      /**
       * Add hooks on specific state changes.
       */
      hooks?: IHooks;

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

      /**
       * Add hooks on specific state changes.
       */
      hooks?: IHooks;

      /**
       * If set to true the `requestAds()` call will keep the app in the [[ISinglePageApp]]
       * If set to false the `requestAds() call will transition the state to [[IRequestAds]]
       */
      isSinglePageApp: boolean;
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
     * Publisher enabled the single page application mode.
     */
    export interface ISinglePageApp extends IState {
      readonly state: 'spa';

      /**
       * Immutable configuration. This is the same configuration returned by
       * the initialized Promise.
       */
      readonly config: Moli.MoliConfig;

      /**
       * Refresh ads
       */
      readonly refreshAds: (config: Moli.MoliConfig) => void;

      /**
       * Destroy all ad slots and prebid ad units
       *
       * @return promise resolves when all ad slots have been destroyed
       */
      readonly destroyAdSlots: (config: Moli.MoliConfig) => Promise<Moli.MoliConfig>;

      /**
       * stores the information if the moli ad tag is configured yet
       */
      readonly initialized: Promise<Moli.MoliConfig>;

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
    export type IStateMachine = IConfigurable | IConfigured | ISinglePageApp | IRequestAds | IFinished | IError;

    export interface IHooks {
      /**
       * This function is triggered before the state changes to `requestAds`.
       *
       * ## Use cases
       *
       * Use this hook if you need to access the final [[Moli.MoliConfig]].
       *
       * @param config - the final [[Moli.MoliConfig]]
       */
      beforeRequestAds?: (config: Moli.MoliConfig) => void;

      afterConsentAcquired?: () => void;


    }
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
     * https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
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
   * ## SizeConfig entry
   *
   * Configure sizes and labels based on media queries.
   *
   * This is the most complex part of a publisher ad tag setup. The size config defines
   *
   * - if an ad slot is loaded
   * - what sizes are requested
   *
   * ## Prebid API
   *
   * The API is identical to the Prebid size config feature. However we do not pass the
   * size config down to prebid as we already apply the logic at a higher level. We only
   * pass the `labels` to the`requestBids({ labels })` call. Sizes are already filtered.
   *
   *
   * @see [Configure-Responsive-Ads](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads)
   * @see [Conditional Ad Units](https://prebid.org/dev-docs/conditional-ad-units.html)
   * @see [Size Mapping](https://prebid.org/dev-docs/examples/size-mapping.html)
   * @see [requestBids with labels](https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.requestBids)
   */
  export interface SizeConfigEntry {
    /** media query that must match if the sizes are applicable */
    readonly mediaQuery: string;

    /** static sizes that are support if the media query matches */
    readonly sizesSupported: DfpSlotSize[];

    /** labels that are available if the media query matches */
    readonly labels: string[];
  }

  /**
   * ## Slot SizeConfig entry
   *
   * Configure sizes based on media queries for a single `IAdSlot`.
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
   *   mediaQuery: (max-width: 767px)
   *   sizesSupported: [[300,250]]
   * }, {
   *   // desktop sidebar supports medium rectangle
   *   mediaQuery: (min-width: 768px)
   *   sizesSupported: [[300,250]]
   * }]
   * ```
   *
   * This result in `[[300,250]]` being always supported, which may not be something you want.
   *
   */
  export type SlotSizeConfigEntry = Pick<SizeConfigEntry, 'mediaQuery' | 'sizesSupported'>;

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
     * - [Configure-Responsive-Ads](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads)
     * - [Conditional Ad Units](https://prebid.org/dev-docs/conditional-ad-units.html)
     * - [Size Mapping](https://prebid.org/dev-docs/examples/size-mapping.html)
     */
    readonly labelAny?: string[];
    readonly labelAll?: string[];


    /**
     * Provide an optional size config to create supported sizes for this ad slot.
     *
     * - The global `supportedSizes` will be **ignored**
     * - The global `labels` will be **used**
     *
     * NOTE: This should not be used to create labels. Use the global SizeConfig to
     *       create labels for filtering entire ad slots.
     *
     */
    readonly sizeConfig?: SlotSizeConfigEntry[];

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

    /**
     * Configure the refresh behaviour.
     *
     * - `false` (default)
     *    the ad slot is refreshed instantly, acting like an eager loading slot
     * - `true`
     *    the ad slot is refreshed (requested) when the first event is fired, acting like a lazy loading slot
     */
    readonly lazy?: boolean;
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

    /** A function from the global or slot-local sizeConfig provided to filter the sizes provided by the slot */
    readonly filterSupportedSizes: (givenSizes: DfpSlotSize[]) => DfpSlotSize[];

    /** The actual dfp slot returned by `googletag.defineSlot` or `googletag.defineOutOfPageSlot` */
    readonly adSlot: googletag.IAdSlot;
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
     *
     * @see [[LazyAdSlot]]
     *
     * ## Refreshable
     *
     * This allows an ad slot to be requested multiple times. A `trigger` configures when the slot is refreshed.
     * Use cases for this setting:
     *
     *  1. Sort or filter listings and reload the ad slots
     *  2. Layout changes (e.g. card listing vs. row based listing)
     *  3. Single Page Applications (not tested yet)
     *
     * A refreshable slot can also be _lazy_, which means that the first trigger also triggers the first ad request.
     * The default behaviour is _not lazy_.
     *
     * @see [[RefreshableAdSlot]]
     *
     */
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

      /**
       * the source that fires the event.
       * - window
       * - document
       * - or a query selector for a DOM Node
       */
      readonly source: Window | Document | string;
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
    export type PrebidAdSlotConfigProvider =
      PrebidAdSlotConfig
      | ((context: PrebidAdSlotContext) => PrebidAdSlotConfig);

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
      /** https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
      readonly config: prebidjs.IPrebidJsConfig;

      /** optional bidder settings */
      readonly bidderSettings?: prebidjs.IBidderSettings;

      /** optional listener for prebid events */
      readonly listener?: PrebidListener;

      /**
       * If true, moli will use `window.moliPbjs` to access the prebid instance. The actual renaming of this
       * variable has to be done in the publisher tag.
       *
       * default: `false`
       */
      readonly useMoliPbjs?: boolean;
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
    }
  }

  /**
   * # Consent Management
   *
   * GDPR compliant consent management configuration.
   *
   * ## GPT - Google Publisher Tag
   *
   * The [PersonalizedAdsProvider](#personalizedadsprovider) configures the `setNonPersonalizedAds()`
   * method call on the `PubAdsService`.
   *
   * There are three variants
   *
   * - [Static](/interfaces/_moli_.moli.consent.static.html) - a fixed value
   * - [Cookie](/interfaces/_moli_.moli.consent.cookie.html) - based on a cookie
   * - [CMP](/interfaces/_moli_.moli.consent.cmp.html) - use an IAB CMP API
   *
   * ## Prebid
   *
   * Prebid comes with its IAB compliant consent management framework. Make sure you have the
   * `ConsentManagement` module. This must be in the `modules.json`.
   *
   * ```json
   * [
   *   ...
   *   "consentManagement",
   *   ...
   * ]
   * ```
   *
   *
   * @see [Prebid GDPR ConsentManagement Module](https://prebid.org/dev-docs/modules/consentManagement.html)
   * @see [[ConsentConfig]] for the overall configuration options
   * @see [[PersonalizedAdsProvider]] for DFP consent configuration options
   *
   */
  export namespace consent {

    /**
     * # Consent Configuration
     *
     * This object contains all relevant information for configuring consent. This is a very crucial part
     * of our ad setup as the consent rate determines the overall performance of all partners.
     *
     * ## Personalized Ads Provider
     *
     * Configure the consent management for DFP.
     *
     *
     * @see [[PersonalizedAdsProvider]] for DFP consent management
     */
    export interface ConsentConfig {

      /** DFP `setNonPersonalizedAds` configuration provider */
      readonly personalizedAds: consent.PersonalizedAdsProvider;

      /** CMP - publisher specific or faktor.io */
      readonly cmpConfig: consent.CmpConfigVariants;
    }

    /**
     * Union type for the different dfp `setNonPersonalizedAds` implementations.
     */
    export type PersonalizedAdsProvider = Static | Cmp | Cookie;

    /**
     * Union type for different CMPs
     */
    export type CmpConfigVariants = PublisherCmpConfig | FaktorCmpConfig;

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
     * @example Example to set `googletag.setNonPersonalizedAds(0)` which results in **personalized** ads.<br>
     * ```typescript
     * {
     *   provider: 'static',
     *   value: 0
     * }
     * ```
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
     * @example Example for a cookie based configuration. <br>
     * ```typescript
     * {
     *   provider: 'cookie',
     *   cookie: '_sp_enable_dfp_personalized_ads',
     *   valueForNonPersonalizedAds: 'false'
     * }
     * ```
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
   * Base interface for CMP differentiating between differen CMP providers
   */
  export interface CmpConfig {
    readonly provider: 'publisher' | 'faktor';
  }

  /**
   * If the publisher has it's own cmp
   */
  export interface PublisherCmpConfig extends CmpConfig {
    readonly provider: 'publisher';
  }

  /**
   * If faktor.io is used as cmp
   */
  export interface FaktorCmpConfig extends CmpConfig {
    readonly provider: 'faktor';
    readonly autoOptIn: boolean;
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
   * * `a9Load`     - measurement from `fetchBids` to `bidsBackHandler` called
   * * `ttfa`       - Time-To-First-Ad measurement from `requestAds` to the first ad slot render call
   * * `ttfr`       - Time-To-FIrst-Render measurement from `requestAds` to first ad slot fully rendered
   * * `adslot`     - Contains multiple metrics for a single ad slot. See `AdSlotMetric` for more details.
   *
   *
   * ## Integration
   *
   * @example A simple integration in the ad configuration object. To see the console reporter implementation
   * take a look [the reporter type](#reporter).
   * ```typescript
   * reporting: {
   *   // report everything
   *   sampleRate: 1,
   *   // a regex that splits the publisher id and `gf` from the ad unit path
   *   adUnitRegex: /\/\d*\/gf\//i,
   *   // an array of reporters
   *   reporters: [
   *     consoleLogReporter
   *   ]
   * }
   * ```
   *
   * @see [The Reporter type contains implementation examples](#reporter).
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
     *
     * @example A simple console log reporter that logs everything in grouped outputs.
     * </br></br>
     * ```typescript
     * import { Moli } from 'moli-ad-tag/source/ts/types/moli';
     * export const consoleLogReporter: Moli.reporting.Reporter = (metric: Moli.reporting.Metric) => {
     *
     * switch (metric.type) {
     *    case 'dfpLoad': {
     *      console.groupCollapsed('DFP Load Time');
     *      console.log('startTime', Math.round(metric.measurement.startTime));
     *      console.log('duration', metric.measurement.duration);
     *      console.groupEnd();
     *      break;
     *    }
     *    case 'prebidLoad': {
     *      console.groupCollapsed('Prebid Load Time');
     *      console.log('name', metric.measurement.name);
     *      console.log('startTime', Math.round(metric.measurement.startTime));
     *      console.log('duration', Math.round(metric.measurement.duration));
     *      console.groupEnd();
     *      break;
     *    }
     * case 'a9Load': {
     *      console.groupCollapsed('A9 Load Time');
     *      console.log('name', metric.measurement.name);
     *      console.log('startTime', Math.round(metric.measurement.startTime));
     *      console.log('duration', Math.round(metric.measurement.duration));
     *      console.groupEnd();
     *      break;
     *    }
     *    case 'ttfa': {
     *      console.groupCollapsed('Time to first Ad');
     *      console.log('visible at', Math.round(metric.measurement.startTime + metric.measurement.duration));
     *      console.log('startTime', Math.round(metric.measurement.startTime));
     *      console.log('duration', Math.round(metric.measurement.duration));
     *      console.groupEnd();
     *      break;
     *    }
     *    case 'ttfr': {
     *      console.groupCollapsed('Time to first Render');
     *      console.log('rendered at', Math.round(metric.measurement.startTime + metric.measurement.duration));
     *      console.log('startTime', Math.round(metric.measurement.startTime));
     *      console.log('duration', Math.round(metric.measurement.duration));
     *      console.groupEnd();
     *      break;
     *    }
     *    case 'adSlots': {
     *      console.groupCollapsed('AdSlot metrics');
     *      console.log('number of slots', metric.numberAdSlots);
     *      console.log('number of empty slots', metric.numberEmptyAdSlots);
     *      console.groupEnd();
     *      break;
     *    }
     *    case 'adSlot': {
     *      console.groupCollapsed(`AdSlot: ${metric.adUnitName}`);
     *      console.log('advertiser id', metric.advertiserId);
     *      console.log('order id', metric.campaignId);
     *      console.log('line item id', metric.lineItemId);
     *      console.log('render start at', Math.round(metric.rendered.startTime));
     *      console.log('rendering duration', Math.round(metric.rendering.duration));
     *      console.log('loaded at', Math.round(metric.loaded.startTime + metric.loaded.duration));
     *      console.groupEnd();
     *      break;
     *    }
     * }
     * ```
     */
    export type Reporter = (metric: Metric) => void;


    /**
     * Union type for all provided metric types.
     */
    export type MetricType = 'cmpLoad' | 'dfpLoad' | 'prebidLoad' | 'a9Load' | 'ttfa' | 'ttfr' | 'adSlot' | 'adSlots';

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
    export type Metric = SingleMeasurementMetric | AdSlotMetric | AdSlotsMetric | BooleanMetric;

    /**
     * The boolean metrics represent all metrics with a boolean value
     */
    export interface BooleanMetric {

      /**
       * All metrics that provide only a boolean value.
       */
      readonly type: 'consentDataExists';

      /**
       * The boolean value provided by the metric `type`
       */
      readonly value: boolean;
    }

    /**
     * The single measure metric represents all metrics with only one measure.
     */
    export interface SingleMeasurementMetric extends IMetric {

      /**
       * All metrics that provide only a single measurement point.
       */
      readonly type: 'cmpLoad' | 'dfpLoad' | 'prebidLoad' | 'a9Load' | 'ttfa' | 'ttfr';

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
   * # Logger interface
   *
   * The default logging implementation uses `window.console` as the output.
   * Publishers may plugin their own logging implementation.
   *
   * ## Usage
   *
   * The ad tag needs to be in _publisher mode_
   *
   * ```
   * window.moli = window.moli || { que: [] };
   * window.moli.que.push(function(moliAdTag) {
   *   moliAdTag.setLogger(logger)
   * });
   * ```
   *
   * @example Noop logger <br><br>
   * ```
   * const noopLogger = {
   *    debug: () => { return; },
   *    info: () => { return; },
   *    warn: () => { return; },
   *    error: () => { return; }
   * };
   *
   * window.moli = window.moli || { que: [] };
   * window.moli.que.push(function(moliAdTag) {
   *   moliAdTag.setLogger(noopLogger)
   * });
   * ```
   *
   * @example console logger <br><br>
   * ```
   * const noopLogger = {
   *    debug: window.debug,
   *    info: window.info,
   *    warn: window.info,
   *    error: window.info
   * };
   *
   * window.moli = window.moli || { que: [] };
   * window.moli.que.push(function(moliAdTag) {
   *   moliAdTag.setLogger(noopLogger)
   * });
   * ```
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

    /**
     * moli prebid.js instance if the publisher tag renames the globalVarName setting for prebid.
     *
     * @see [[PrebidConfig.useMoliPbjs]]
     */
    moliPbjs: prebidjs.IPrebidJs;
  }
}

/* tslint:enable:interface-name */
