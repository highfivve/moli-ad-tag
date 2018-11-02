/* tslint:disable:interface-name */

export namespace Moli {

  export type DfpSize = [number, number] | 'fluid';
  type DfpKeyValue = { key: string, value: string[] | string };

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
     * This is an alternative solution to custom () => DfpSize[] functions and is taken
     * from prebid.js.
     *
     * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly sizeConfig?: SizeConfigEntry[];

    /** optional prebid configuration */
    readonly prebid?: {

      /** http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
      readonly config: headerbidding.PrebidConfig | (() => headerbidding.PrebidConfig);
    };

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

  export interface AdSlot {
    /** id for the ad slot element */
    readonly domId: string;

    /** dfp adUnit path for this slot */
    readonly adUnitPath: string;

    /** the sizes for this ad slot */
    readonly sizes: DfpSize[];

    /** is this a dfp out-of-page (interstitial) slot or not */
    readonly position: 'in-page' | 'out-of-page';

    /** configure how and when the slot should be loaded */
    readonly behaviour: behaviour.SlotLoadingBehaviour;

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
    readonly prebid?: {
      /** bids configuration */
      readonly bids: headerbidding.PrebidAdUnit[]
    };

    /** optional a9 configuration if this ad slot can also be used by a9 */
    readonly a9?: {
      readonly enabled: boolean;
    };
  }

  /** slot behaviour namespace */
  export namespace behaviour {

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
    interface EventTrigger {
      readonly name: 'event';

      /** the event name */
      readonly event: string;
    }

    /** triggers when a certain element is visible */
    interface VisibleTrigger {
      readonly name: 'visible';

      /** the DOM element that needs to be visible */
      readonly domId: string;
    }

  }

  /** header bidding types */
  export namespace headerbidding {
    /**
     * Prebid configuration
     * http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
     */
    export interface PrebidConfig {
    }

    /**
     * http://prebid.org/dev-docs/publisher-api-reference.html#addAdUnits-AdUnitProperties
     */
    export interface PrebidAdUnit {
    }

    /**
     * See internal A9 apstag documentation
     */
    export interface A9AdSlot {
    }
  }

  /** pluggable logger */
  export interface MoliLogger {

    debug(msg: string): void;

    info(msg: string): void;

    warn(msg: string): void;

    error(msg: string): void;

  }

  export interface MoliWindow {
    moliConfig: Moli.MoliConfig;
  }
}

/* tslint:enable:interface-name */
