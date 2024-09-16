import { googletag } from './googletag';
import { prebidjs } from './prebidjs';
import { IModule, ModuleMeta } from './module';
import { IAssetLoaderService } from '../util/assetLoaderService';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from '../ads/adPipeline';
import {
  AdSlot,
  AdUnitPathVariables,
  behaviour,
  Environment,
  googleAdManager,
  MoliConfig,
  ResolveAdUnitPathOptions
} from './moliConfig';

/**
 * ## Moli Runtime Configuration & API
 *
 * This file contains the API and runtime configuration for the moli ad tag. This includes the state machine that
 * controls the behaviour of the ad tag.
 *
 */
export namespace MoliRuntime {
  export type MoliCommand = (moli: MoliTag) => void;

  /**
   * # Moli Ad Tag
   *
   * This defines the publisher facing API. When the ad tag is configured in _publisher mode_, which means it doesn't fire
   * `requestAds()` immediately after being loaded, publishers can customize the integration.
   *
   *
   * ## Usage
   *
   * The general usage pattern is like `gpt` or `prebid`. If the ad tag is not yet available, commands can be pushed to
   * a que that will eventually be processed.
   *
   * @example minimal example on how to request ads
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
     * the moli ad tag library version
     */
    version: string;

    /**
     * The label that is used to identify the configuration in the ad tag.
     *
     * This value is set by the `configureFromEndpoint` bundle that reads the script tag information.
     * It may be undefined if the ad tag is configured manually or the `configureFromEndpoint` bundle failed.
     */
    configLabel?: string;

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
     * Sets new ad unit path variables.
     * @param variables
     */
    setAdUnitPathVariables(variables: AdUnitPathVariables): void;

    /**
     * Resolves an ad unit path by replacing the ad unit path variables.
     * Optionally the networkChildId can be removed.
     *
     * @param adUnitPath the ad unit path that may contain variables in the form of `{variable name}`
     * @param options configure resolving behaviour
     */
    resolveAdUnitPath(adUnitPath: string, options?: ResolveAdUnitPathOptions): string;

    /**
     * Set a custom logger that should be used for logging.
     *
     * @param logger
     * @see [[MoliLogger]]
     */
    setLogger(logger: MoliLogger): void;

    /**
     * Set the beforeRequestAds hook, which is triggered before the ads are being requested
     * with the final [[Moli.MoliConfig]].
     *
     * @param callback
     */
    beforeRequestAds(callback: (config: MoliConfig) => void): void;

    /**
     * Set the afterRequestAds hook, which is triggered after the ads have been requested.
     * The callback will receive the name of the new state the ad tag has.
     *
     * @param callback
     */
    afterRequestAds(callback: (state: state.AfterRequestAdsStates) => void): void;

    /**
     * Register a module to configure publisher specific behaviour. This API is not for external
     * usage. All list of modules can be received from highfivve.
     *
     * @param module
     */
    registerModule(module: IModule): void;

    /**
     * **WARNING**
     * This method is called by the ad tag and can only be called once. If the publisher calls
     * `configure` then the ad configuration provided by the ad tag may not be used.
     *
     *
     * @param config the ad configuration
     * @returns a promise which resolves when the content of all eagerly initialized slots are loaded
     */
    configure(config: MoliConfig): Promise<MoliRuntime.state.IStateMachine | null>;

    /**
     * Start requesting ads as soon as the tag has been configured.
     *
     * The behaviour differs if `spa.enabled: true`
     */
    requestAds(): Promise<
      state.IConfigurable | state.ISinglePageApp | state.IFinished | state.IError
    >;

    /**
     * Refresh the given ad slot as soon as possible.
     *
     * This is only possible for ad slots with a `manual` loading behaviour.
     *
     * Ad slots are batched until requestAds() is being called. This reduces the amount of requests made to the
     * ad server if the `refreshAdSlot` calls are before the ad tag is loaded.
     *
     * **Usage**
     *
     * Refreshing a single ad slot that has loading behaviour `manual`.
     *
     * ```javascript
     * moli.refreshAdSlots(['content_1']);
     * ```
     *
     * Refreshing multiple ad slots that have loading behaviour `manual`.
     *
     * ```javascript
     * moli.refreshAdSlots(['content_1', 'content_2']);
     * ```
     *
     * Refreshing a single ad slot that has loading behaviour `backfill` with custom options.
     *
     * ```javascript
     * moli.refreshAdSlots(['content_1'], { loaded: 'backfill' });
     * ```
     *
     * @param domId - identifies the ad slot or ad slots
     * @param options - optional options to override the default refreshing behaviour
     */
    refreshAdSlot(
      domId: string | string[],
      options?: RefreshAdSlotsOptions
    ): Promise<'queued' | 'refreshed'>;

    /**
     * Copy the configuration of a slot with an `infinite` loading behaviour and add it to a slot with the given domId.
     * Refresh the created ad slot as soon as possible afterwards.
     *
     * Ad slots are batched until requestAds() is being called. This reduces the amount of requests made to the
     * ad server if the `refreshInfiniteAdSlot` calls are before the ad tag is loaded.
     *
     * -----------------------------------------------------------------------------------------------------------------
     *
     * This API is mostly used in combination with the lazy-loading module that identifies slots
     * which should be treated as infinite ad units with the help of a given CSS selector.
     *
     * The publisher needs to make sure:
     * - all infinite ad units are already in the DOM
     * - all infinite ad units in the DOM have the same CSS class/attribute (no domId needed, it will be set automatically in a sequential order)
     *
     * Requirements in the ad tag:
     * - the corresponding CSS selector is used as `selector` in the configuration of the one ad slot that has an `infinite` laading behavior
     * - the same CSS selector is used in the lazy-loading module
     *
     * @param domId - the domId of the newly created ad slot
     * @param idOfConfiguredSlot - the domId of the configured ad slot with an `infinite` loading behaviour whose config should be copied
     */

    refreshInfiniteAdSlot(
      domId: string,
      idOfConfiguredSlot: string
    ): Promise<'queued' | 'refreshed'>;

    /**
     * Refresh the given bucket as soon as possible.
     *
     * This is only possible for ad slots with a `manual` loading behaviour and bucket is enabled
     *
     * Ad slots in buckets are batched until requestAds() is being called. This reduces the amount of requests made to the
     * ad server if the `refreshAdSlot` calls are before the ad tag is loaded.
     *
     * @param bucket - identifies the bucket
     */
    refreshBucket(bucket: string): Promise<'queued' | 'refreshed'>;

    /**
     * Refresh the given bucket as soon as possible.
     *
     * This is only possible for ad slots with a `manual` loading behaviour and bucket is enabled
     *
     * Ad slots in buckets are batched until requestAds() is being called. This reduces the amount of requests made to the
     * ad server if the `refreshAdSlot` calls are before the ad tag is loaded.
     *
     * @param bucket - identifies the bucket
     */
    refreshBucket(bucket: string): Promise<'queued' | 'refreshed'>;

    /**
     * Returns the  current state of the configuration. This configuration may not be final!
     * If you need to access the final configuration use the `beforeRequestAds` method to configure
     * a callback.
     *
     *
     * @returns the configuration used to initialize the ads. If not yet initialized, null.
     * @see [[beforeRequestAds]]
     */
    getConfig(): Readonly<MoliConfig> | null;

    /**
     * Returns the current runtime configuration. This configuration may not be final!
     *
     * Note, that even if the type declares it as readonly, the configuration is mutable. Don't make use of this!
     * Always use moli APIs to change the configuration.
     *
     * @returns the current state of the runtime config.
     */
    getRuntimeConfig(): Readonly<MoliRuntimeConfig>;

    /**
     * Returns the current page targeting. It's a snapshot of the current targeting values set by the server side
     * `targeting` property and the client side `setTargeting` and `addLabel` method invocations that are stored in the
     * `MoliRuntimeConfig`.
     *
     * Runtime configuration takes precedence over the static configuration.
     *
     * @returns the current page targeting
     */
    getPageTargeting(): Readonly<googleAdManager.Targeting>;

    /**
     * @returns the current state name
     */
    getState(): state.States;

    /**
     * @returns meta information about the active moli modules
     */
    getModuleMeta(): ReadonlyArray<ModuleMeta>;

    /**
     * Open the moli debug console.
     *
     * Request the debug bundle and start the debug mode.
     * @param path - [optional] full path to the moli debug script.
     */
    openConsole(path?: string): void;

    /**
     * @return the asset loader service that is used to fetch additional assets / resources
     */
    getAssetLoaderService(): IAssetLoaderService;
  }

  /**
   * ## Moli Runtime Configuration
   *
   * This configuration contains the additional runtime configuration added through the various moli APIs, such as
   *
   * - `addLabel`
   * - `setTargeting`
   * - `addInitStep`
   * - `addConfigureStep`
   * - `addPrepareRequestAdsStep`
   *
   */
  export interface MoliRuntimeConfig {
    /**
     * Configure the environment the ad tag should use.
     *
     * The default environment is `production` as we have a very conservative way of deploying
     * applications.
     *
     * default: 'production'
     * @see [[Environment]]
     */
    environment?: Environment;

    /**
     * contains additional ad pipeline steps added through the `moli.add*Step` methods.
     */
    readonly adPipelineConfig: AdPipelineConfig;

    /**
     * Additional key-values. Insert with
     *
     * @example
     * window.moli.que.push(function(moli) => {
     *   moli.setTargeting(key, value);
     * });
     *
     */
    readonly keyValues: googleAdManager.KeyValueMap;

    /**
     * Additional labels. Insert with
     *
     * @example
     * window.moli.que.push(function(moli) => {
     *   moli.addLabel('foo');
     * });
     */
    readonly labels: string[];

    /**
     * An object of ad unit path variables. It's mutable because it can only be set as a whole via `setAdUnitPathVariables`.
     * There's no real use case for changing individual variables as all ad unit path variables must be known before
     * `requestAds` is called.
     */
    adUnitPathVariables: AdUnitPathVariables;

    /**
     * A list of ad slots that should be refreshed
     */
    readonly refreshSlots: string[];

    /**
     * A list of infinite ad slots that should be refreshed
     */
    readonly refreshInfiniteSlots: IRefreshInfiniteSlot[];

    /**
     * Add hooks on specific state changes.
     */
    readonly hooks: state.IHooks;

    /**
     * Custom logger
     */
    logger?: MoliLogger;
  }

  /**
   * ## Refresh Ad Slot Options
   *
   * You can override the default refreshing behaviour with this object. The ad tag has some default behaviours that
   * try to prevent fraudulent or unwanted behaviour. This object allows you to override those behaviours.
   *
   * 1. Refreshing eager slots
   * 2. Refreshing backfill slots
   *
   */
  export interface RefreshAdSlotsOptions {
    /**
     * By default, only ad slots with loading behaviour `manual` are refreshed. You can override this behaviour by
     * specifying the loading behaviour here. This serves two uses cases
     *
     * 1. Refreshing `eager` slots. This is useful if you have a eager slot, but it may be refreshed later by a user actions,
     *    e.g. a filter selection
     * 2. Refreshing `backfill` slots. Those slots are never refreshed by default, but you can force a refresh with this option.
     *
     * @default `'manual'`
     */
    readonly loaded?: Exclude<behaviour.ISlotLoading['loaded'], 'infinite'>;

    /**
     * Ability to override the sizes of the ad slot for this single refresh call.
     *
     * The common use case is to reduce the sizes if the ad slot is automatically reloaded to all sizes
     * that are smaller than the last winning size to avoid any layout shifts (CLS).
     *
     * Note that only sizes can be used that are covered by a size configuration. Sizes that don't match any size config,
     * will be filtered out and may lead to the ad slot not being refreshed.
     */
    readonly sizesOverride?: googleAdManager.SlotSize[];
  }

  /**
   * Models `refreshInifiniteAdSlot` calls before ads are being requested
   */
  export type IRefreshInfiniteSlot = {
    /**
     * the newly created domID by the infinite slot loading behaviour.
     * This ID can be used to reference the ad slot in the config in the
     * ad pipeline context config.
     */
    readonly artificialDomId: string;

    /**
     * the domID that references the slot configuration in the original
     * config.
     */
    readonly idOfConfiguredSlot: string;
  };

  /**
   *
   * ## State transitions
   *
   * The state machine is defined as:
   *
   * ```
   *                                                                                   setXYZ / addXYZ
   *                                                                                   requestAds()
   *
   *                                                                                   +----------+
   *                                                                                   |          |
   *                                                                                   |          |
   *                                                                                   |          v
   *                                                                                   |
   *                                         +------------+     requestAds()     +-----+-------------------------+
   *                                         |            |                      |                               |
   *                                         | configured |  +---------------->  | Single Page App               |
   *                                         |            |                      | spa-requestAds / spa-finished |
   *                                         +------------+                      +-------------------------------+
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
   * ```
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
   * In this state the ad tag allows to call `requestAds()` multiple times. The ad tag state will
   * remain `spa` if there are no errors. Note that `requestAds()` call is only allowed if the
   * `window.location.href` has changed. This is a safety guard against unwanted ad fraud behaviour.
   *
   * KeyValues and Labels are handled depending on their source:
   *
   * - keyValues and labels from the static configuration shipped with the ad tag persist.
   * - keyValues and labels configured via `setTargeting(...)` and `addLabel(...)` are only valid
   *   for the next `requestAds()` call and will be cleaned afterwards.
   *
   *
   * Supported loading behaviours is `eager`.
   *
   * #### Integration
   *
   * Single page applications are quite more complex than purely server-side-rendered websites. We have
   * a set of APIs at our disposal to deal with that.
   **
   * Slots that are **server-side rendered** and never removed. Examples for this there are header area slots
   *    that are part of the generic page layout that does not change on any page.
   *    *Configuration:* Use the `eager` loading behaviour.
   *
   * Eager slots (configuration 1) don't need any special handling as the DOM element is present when the
   * site is being delivered and everything works as if it weren't a single page app.
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
    export type States =
      | 'configurable'
      | 'configured'
      | 'spa-finished'
      | 'spa-requestAds'
      | 'requestAds'
      | 'finished'
      | 'error';

    /**
     * Base interface for all states.
     */
    export interface IState {
      readonly state: States;
    }

    /**
     * State that is already configured.
     */
    interface WithConfiguration {
      /**
       * The configuration set either via `configure(...)` or provided
       */
      readonly config: MoliConfig;
    }

    /**
     * State that have a runtime configuration.
     */
    interface WithRuntimeConfiguration {
      /**
       * Changeable configuration if other settings have been pushed into the que.
       * This configuration is mutable by definition.
       */
      readonly runtimeConfig: MoliRuntimeConfig;
    }

    interface WithModulesConfigurable {
      /**
       * Contains the list of modules that need to be initialized
       */
      readonly modules: IModule[];
    }

    interface WithModules {
      /**
       * Contains the list of modules that need to be initialized
       */
      readonly modules: ReadonlyArray<IModule>;
    }

    export interface IConfigurable
      extends IState,
        WithRuntimeConfiguration,
        WithModulesConfigurable {
      readonly state: 'configurable';

      /**
       * The config is undefined in the initial state of the ad tag
       */
      readonly config?: never;

      // changeable configuration options

      /**
       * If set to true, initializes the ad tag as soon as the ad configuration has been set.
       * If set to false, nothing will initialize until `moli.initialize` is called
       */
      initialize: boolean;
    }

    /**
     * The ad configuration has been set
     */
    export interface IConfigured
      extends IState,
        WithRuntimeConfiguration,
        WithConfiguration,
        WithModulesConfigurable {
      readonly state: 'configured';
    }

    /**
     * Moli should be initialized. This can only be done from the "configured" state.
     *
     * If moli is in the "configurable" state, the `initialize` flag will be set to true
     * and moli is initialized once it's configured.
     */
    export interface IRequestAds
      extends IState,
        WithRuntimeConfiguration,
        WithConfiguration,
        WithModules {
      readonly state: 'requestAds';
    }

    /**
     * Publisher enabled the single page application mode.
     */
    export interface ISinglePageApp
      extends IState,
        WithRuntimeConfiguration,
        WithConfiguration,
        WithModules {
      readonly state: 'spa-finished' | 'spa-requestAds';

      /**
       * stores the information if the moli ad tag is configured yet
       */
      readonly initialized: Promise<MoliConfig>;

      /**
       * the current href. The ad tag checks that `requestAds()` is only called once
       * per href otherwise it will throw an error as `requestAds()` is only allowed
       * once per page.
       */
      readonly href: string;

      /**
       * The single page app states require two runtime configurations. One for the current `requestAds()` cycle.
       * All `refreshAdSlot` calls require the current runtime configuration. However, `set*` and `add*`methods may be
       * called before the next `requestAds()` call and page navigation. Those values are persisted in this variable
       * and are used as soon as `requestAds()` is successfully invoked.
       */
      readonly nextRuntimeConfig: MoliRuntimeConfig;
    }

    /**
     * Moli has finished loading.
     */
    export interface IFinished
      extends IState,
        WithRuntimeConfiguration,
        WithConfiguration,
        WithModules {
      readonly state: 'finished';
    }

    /**
     * Moli has finished loading.
     */
    export interface IError
      extends IState,
        WithRuntimeConfiguration,
        WithModules,
        WithConfiguration {
      readonly state: 'error';

      /**
       * the error. Should  be readable for a key accounter and a techi.
       */
      readonly error: any;
    }

    /**
     * All valid states
     */
    export type IStateMachine =
      | IConfigurable
      | IConfigured
      | ISinglePageApp
      | IRequestAds
      | IFinished
      | IError;

    export type AfterRequestAdsStates = Extract<
      state.States,
      'finished' | 'error' | 'spa-finished'
    >;

    /**
     * Callback function executed before ads are being requested.
     * DOM is ready at this point.
     */
    export type BeforeRequestAdsHook = (
      config: MoliConfig,
      runtimeConfig: MoliRuntimeConfig
    ) => void;

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
      readonly beforeRequestAds: BeforeRequestAdsHook[];

      /**
       * This function is triggered after `requestAds()` is being called and the ad tag
       * state is
       *
       * - `finished`
       * - `error`
       * - `spa`
       *
       * ## Use cases
       *
       * Use this hook if you need to trigger certain events, when all the ad slots are fully configured.
       * For example if you can load some lazy slots immediately in certain situations and want to fire
       * the trigger event as soon as possible.
       *
       * @example
       * ```
       * window.moli.que.push(function(moliAdTag) {
       *    moliAdTag.afterRequestAds((state) => {
       *       if(state === 'finished') {
       *         triggerLazyLoadingEvents();
       *       }
       *    });
       *
       *    // trigger ads
       *    moliAdTag.requestAds();
       * });
       * ```
       *
       */
      readonly afterRequestAds: Array<(state: AfterRequestAdsStates) => void>;
    }
  }

  export type FilterSupportedSizes = (
    givenSizes: googleAdManager.SlotSize[]
  ) => googleAdManager.SlotSize[];

  /**
   * Combines the moli slot configuration (`Moli.AdSlot`) along with the actual `googletag.IAdSlot` definition.
   *
   * This model lets you work with the materialized slot (`googletag.IAdSlot`), while having access to the
   * configuration settings from the `Moli.AdSlot` definition.
   *
   * It also contains meta information that are being added in the `prepareRequestAds` phase.
   */
  export interface SlotDefinition<S extends AdSlot = AdSlot> {
    /** The moli adSlot configuration */
    readonly moliSlot: S;

    /** A function from the slot-local sizeConfig provided to filter the sizes provided by the slot */
    readonly filterSupportedSizes: FilterSupportedSizes;

    /** The actual dfp slot returned by `googletag.defineSlot` or `googletag.defineOutOfPageSlot` */
    readonly adSlot: googletag.IAdSlot;

    /**
     * An optional price rule associated with this ad slot.
     *
     * This may be added by some step in the prepareRequestAds phase.
     */
    priceRule?: yield_optimization.PriceRule;
  }

  /**
   * ## Prebid BidsBackHandler
   *
   * This callback can be registered by modules to react on the prebid bids back event.
   * It contains additional information from the ad pipeline run.
   */
  export type PrebidBidsBackHandler = (
    context: AdPipelineContext,
    bidResponses: prebidjs.IBidResponsesMap,
    slotDefinitions: SlotDefinition<AdSlot>[]
  ) => void;

  /** header bidding types */
  export namespace headerbidding {
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
      readonly keyValues: googleAdManager.KeyValueMap;

      /**
       * Floor price in EUR
       *
       * @deprecated use `priceRule?.floorprice` instead
       */
      readonly floorPrice: number | undefined;

      /**
       * A unified pricing rule if available for this ad slot
       */
      readonly priceRule?: yield_optimization.PriceRule | undefined;

      /**
       * all supported labels
       */
      readonly labels: string[];

      /**
       * true if `labels` does not contain 'desktop'
       */
      readonly isMobile: boolean;
    }

    /**
     * A `PrebidListener` configuration can either be created
     *
     * - as a static value
     * - from a function which takes a `PrebidListenerContext`
     */
    export type PrebidListenerProvider =
      | PrebidListener
      | ((context: PrebidListenerContext) => PrebidListener);

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
     * ```typescript
     *
     * const checkForGumGumWallpaper = (bidResponses: prebidjs.IBidResponseMap): boolean => {
     *   const wallpaperAdSlot = bidResponses['ad-wallpaper']; // select the ad slot by using the DOM ID
     *   // if available during this request
     *   if (wallpaperAdSlot) {
     *      return wallpaperAdSlot.bids.filter((bidResponse: prebidjs.BidResponse) => {
     *          return bidResponse.bidder == 'gumgum' && bidResponse.cpm > 0
     *      }).length !== 0;
     *   }
     *   return false;
     * }
     *
     * const prebidListener = {
     *   preSetTargetingForGPTAsync: (bidResponses: prebidjs.IBidResponsesMap, timedOut: boolean, slotDefinitions: SlotDefinition<AdSlot>[]) => {
     *     if (this.checkForGumGumWallpaper(bidResponses)) {
     *       // finds the googletag.AdSlot and calls googletag.destroySlots([skyScraperSlot]);
     *       this.destroySkyscraperAdUnit(slotDefinitions);
     *     }
     *   }
     * }
     * ```
     */
    export interface PrebidListener {
      /** called in the `bidsBackHandler` before the dfp key-values are being set */
      readonly preSetTargetingForGPTAsync?: (
        bidResponses: prebidjs.IBidResponsesMap,
        timedOut: boolean,
        slotDefinitions: SlotDefinition<AdSlot>[]
      ) => void;
    }

    /**
     * Context for creating a dynamic `PrebidListener` configuration. Grants access to certain values
     * from the `MoliConfig` to configure dynamic behaviour.
     *
     * **Use cases**
     *
     * * key-value targeting for special formats like wallpapers
     *
     */
    export interface PrebidListenerContext {
      /**
       * Access key-values
       */
      readonly keyValues: googleAdManager.KeyValueMap;
    }
  }

  /**
   * ## AdPipeline Config
   *
   * The AdPipeline is the driving data structure behind every ad request. It executes a set of steps in various
   * phases. This additional configuration lets the publisher or modules add new steps to the pipeline.
   *
   */
  export interface AdPipelineConfig {
    /**
     * Additional initSteps that should be executed in every AdPipeline run.
     */
    readonly initSteps: InitStep[];

    /**
     *  Additional configureSteps that should be executed in every AdPipeline run.
     */
    readonly configureSteps: ConfigureStep[];

    /**
     *  Additional prepareRequestAdsSteps that should be executed in every AdPipeline run.
     */
    readonly prepareRequestAdsSteps: PrepareRequestAdsStep[];

    /**
     * Additional requestBidSteps that should be executed in every AdPipeline run.
     */
    readonly requestBidsSteps: RequestBidsStep[];

    /**
     * Synchronous callback immediately after bids have returned.
     *
     * Note: These callbacks should not perform any initialization code or only be created once
     *       as this array will be accessed on every pbjs.requestBids() callback.
     *
     * @see IModule interface for more information
     */
    readonly prebidBidsBackHandler: PrebidBidsBackHandler[];
  }

  /**
   * # Yield Optimization
   *
   * The system is designed to work with Google Ad Managers _Unified Pricing Rules_. The general idea is that
   * key values are being used to target specific pricing rules per ad unit. The configuration when a pricing rule
   * should be applied can be fetched from an external system to allow dynamic floor price optimizations.
   *
   * @see https://support.google.com/admanager/answer/9298008?hl=en
   * @see yield optimization module
   */
  export namespace yield_optimization {
    export interface PriceRule {
      /**
       * Unique identifier for a pricing rule. This will be sent as a key_value `upr_id` per ad unit
       * and will trigger the matching unified pricing rule in Google Ad Manager.
       *
       * The `upr_id` can be a unique id that is associated with a specific cpm or the cpm itself in cents.
       * The cpm in cents is used when "previous bid cpms" is enabled in the global auction context.
       * The cpm is then calculated based on previous bids on the position. In order to avoid a mapping of the calculated cpm and the corresponding unique id, the calculated cpm in cents is directly set as `upr_id`.
       */
      readonly priceRuleId: number;

      /**
       * The model used to determine the price rule
       *
       * - `static`: price rules cohorts in A/B test
       * - `ml`: super clever machine learning
       * - `fixed`: 100% of the traffic gets this fixed price rule
       *
       * If none is provided `static` is used as a fallback
       */
      readonly model?: 'static' | 'ml' | 'fixed';

      /**
       * The floor price CPM in EUR if available.
       */
      readonly floorprice: number;

      /**
       * `true` if this is the main group, which shouldn't be selected for testing.
       *
       * If `false` as key-value can be applied to only select the test cohorts.
       */
      readonly main: boolean;
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
   * @example Noop logger
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
   * @example console logger
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

  export type MoliWindow = Window & {
    /**
     * the global moli tag definition
     */
    moli: MoliRuntime.MoliTag;
  };
}
