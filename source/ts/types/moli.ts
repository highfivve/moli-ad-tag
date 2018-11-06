/* tslint:disable:interface-name */
import { prebidjs } from './prebidjs';

export namespace Moli {

  export type DfpSlotSize = [number, number] | 'fluid';
  type DfpKeyValue = { key: string, value: string[] | string };

  export interface MoliTag {

    /**
     * 
     * @param config the ad configuration
     * @returns a promise which resolves when the content of all eagerly initialized slots are loaded
     */
    initialize(config: MoliConfig): Promise<void>;

    /**
     * @returns the configuration used to initialize the ads. If not yet initialized, undefined.
     */
    getConfig(): MoliConfig | undefined;

  }

  export interface MoliConfig {

    /** all possible ad slots */
    readonly slots: AdSlot[];

    /** optional key-value targeting for DFP */
    readonly targeting?: {

      /** static or supplied key-values */
      readonly keyValues: DfpKeyValue[];
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
    readonly prebid?: {

      /** http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
      readonly config: prebidjs.IPrebidJsConfig;
    };

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
  interface SizeConfigEntry {
    /** media query that must match if the sizes are applicable */
    readonly mediaQuery: string;

    /** static sizes that are support if the media query matches */
    readonly sizesSupported: [number, number][];

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
    // readonly behaviour: behaviour.SlotLoadingBehaviour;

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
    readonly prebid?: headerbidding.PrebidAdSlotConfig;

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
    readonly prebid: headerbidding.PrebidAdSlotConfig;
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

  /** slot behaviour namespace */
  export namespace behaviour {

    export type SlotLoading = 'eager' | 'lazy' | 'refreshable';

    /** How and when should a slot be displayed */
    export type SlotLoadingBehaviour = EagerLoadingBehaviour | LazyLoadingBehaviour | RefreshableBehaviour;

    /** default behaviour - slot is loaded immediately */
    export interface EagerLoadingBehaviour {
      readonly name: 'eager';
    }

    /** slot is loaded lazily based on the configuration */
    export interface LazyLoadingBehaviour {
      readonly name: 'lazy';

      /** what triggers the loading */
      readonly trigger: Trigger;
    }

    /** a slot that is eagerly loaded but can be refreshed */
    export interface RefreshableBehaviour {
      readonly name: 'refreshable';

      /** what triggers the loading */
      readonly trigger: Trigger;
    }

    /** all available triggers for loading behaviours */
    export type Trigger = EventTrigger | VisibleTrigger;

    /** triggers when a certain event is fired */
    export interface EventTrigger {
      readonly name: 'event';

      /** the event name */
      readonly event: string;
    }

    /** triggers when a certain element is visible */
    export interface VisibleTrigger {
      readonly name: 'visible';

      /** the DOM element that needs to be visible */
      readonly domId: string;
    }

  }

  /** header bidding types */
  export namespace headerbidding {

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
    }

    /**
     * See internal A9 apstag documentation
     */
    export interface A9AdSlotConfig { }
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
