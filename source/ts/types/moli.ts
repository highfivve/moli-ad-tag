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

    readonly a9?: headerbidding.A9Config;

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
    readonly prebid?: headerbidding.PrebidAdSlotConfigFactory;

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
    readonly prebid: headerbidding.PrebidAdSlotConfigFactory;
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
    export type PrebidAdSlotConfigFactory = PrebidAdSlotConfig | ((context: PrebidAdSlotContext) => PrebidAdSlotConfig);

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
