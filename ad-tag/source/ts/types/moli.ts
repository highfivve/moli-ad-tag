import { googletag } from './googletag';
import { prebidjs } from './prebidjs';
import { IModule, ModuleMeta } from './module';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../ads/adPipeline';
import { apstag } from './apstag';
import { SupplyChainObject } from './supplyChainObject';
import { EventService } from '../ads/eventService';

export namespace Moli {
  export type DfpSlotSize = [number, number] | 'fluid';

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
   * KeyValue map. Last insert wins.
   */
  export interface DfpKeyValueMap {
    [key: string]: string | string[] | undefined;
  }

  export type MoliCommand = (moli: MoliTag) => void;

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
     * @example On navigation change execute
     * ```
     * window.moli = window.moli || { que: [] };
     * window.moli.que.push(function(moliAdTag) {
     *   moliAdTag.requestAds()
     * });
     * ```
     * @deprecated use the `spa` configuration option in the ad tag configuration instead. This method will soon be removed.
     */
    enableSinglePageApp(): void;

    /**
     * Start requesting ads as soon as the tag has been configured.
     *
     * The behaviour differs if `enableSinglePageApp()` has been called.
     * @see [[enableSinglePageApp]]
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
     * ## Usage
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
     * @param options
     */
    refreshBucket(bucket: string, options?: RefreshAdSlotsOptions): Promise<'queued' | 'refreshed'>;

    /**
     * Returns the  current state of the configuration. This configuration may not be final!
     * If you need to access the final configuration use the `beforeRequestAds` method to configure
     * a callback.
     *
     *
     * @returns the configuration used to initialize the ads. If not yet initialized, null.
     * @see [[beforeRequestAds]]
     */
    getConfig(): MoliConfig | null;

    /**
     * @returns the current state name
     */
    getState(): state.States;

    /**
     * @returns meta information about the active moli modules
     */
    getModuleMeta(): Array<ModuleMeta>;

    /**
     * Open the moli debug console.
     *
     * @param path [optional] full path to the moli debug script.
     * Request the debug bundle and start the debug mode.
     */
    openConsole(path?: string): void;

    /**
     * @return the asset loader service that is used to fetch additional assets / resources
     */
    getAssetLoaderService(): IAssetLoaderService;

    /**
     * Add an event listener for ad request events.
     *
     * @param event The event type
     * @param listener The callback function to be executed with event-specific data
     * @param options Optional configuration for the listener
     */
    addEventListener: EventService['addEventListener'];

    /**
     * Remove an event listener for ad request events.
     *
     * @param event The event type
     * @param listener The callback function to remove
     */
    removeEventListener: EventService['removeEventListener'];
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
  }

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
     * Base interface for all states.
     */
    export interface IState {
      readonly state: States;
      /**
       * Contains stripped-down meta information about all added modules.
       */
      readonly moduleMeta: Array<ModuleMeta>;
    }

    export interface IConfigurable extends IState {
      readonly state: 'configurable';

      // changeable configuration options

      /**
       * If set to true, initializes the ad tag as soon as the ad configuration has been set.
       * If set to false, nothing will initialize until `moli.initialize` is called
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
       * Contains the list of modules that need to be initialized
       */
      modules: IModule[];

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
      hooks: IHooks;

      /**
       * A list of ad slots that should be refreshed
       */
      readonly refreshSlots: string[];

      /**
       * A list of infinite ad slots that should be refreshed
       */
      readonly refreshInfiniteSlots: IRefreshInfiniteSlot[];

      /**
       * An object of ad unit path variables
       */
      adUnitPathVariables: AdUnitPathVariables;
    }

    /**
     * The ad configuration has been set
     */
    export interface IConfigured extends IState {
      readonly state: 'configured';

      /**
       * The original configuration from the ad tag itself. We can use this configuration to
       *
       * - generate a diff for the additions made by the publisher
       * - use this to preserve static targeting values in single application mode
       */
      readonly configFromAdTag: MoliConfig;

      /**
       * Changeable configuration if other settings have been pushed into the que.
       */
      config: Moli.MoliConfig;

      /**
       * Contains the list of modules that need to be initialized
       */
      modules: IModule[];

      /**
       * Add hooks on specific state changes.
       */
      hooks: IHooks;

      /**
       * If set to true the `requestAds()` call will keep the app in the [[ISinglePageApp]]
       * If set to false the `requestAds() call will transition the state to [[IRequestAds]]
       */
      isSinglePageApp: boolean;

      /**
       * A list of ad slots that should be refreshed
       */
      readonly refreshSlots: string[];

      /**
       * A list of infinite ad slots that should be refreshed
       */
      readonly refreshInfiniteSlots: IRefreshInfiniteSlot[];
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
      readonly state: 'spa-finished' | 'spa-requestAds';

      /**
       * Additional key-values. Insert with
       *
       * @example
       * window.moli.que.push(function(moli) => {
       *   moli.setTargeting(key, value);
       * });
       *
       * These will be truncated every time ads are going to be refreshed.
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
       *
       * These will be truncated every time ads are going to be refreshed.
       */
      labels: string[];

      adUnitPathVariables: Moli.AdUnitPathVariables;

      /**
       * Hooks configured by the user
       */
      hooks: IHooks;

      /**
       * A list of ad slots that should be refreshed
       */
      readonly refreshSlots: string[];

      /**
       * A list of infinite ad slots that should be refreshed
       */
      readonly refreshInfiniteSlots: IRefreshInfiniteSlot[];

      /**
       * The original configuration from the ad tag itself. We can use this configuration to
       *
       * - generate a diff for the additions made by the publisher
       * - use this to preserve static targeting values in single application mode
       */
      readonly configFromAdTag: MoliConfig;

      /**
       * Immutable configuration. This is the same configuration returned by
       * the initialized Promise.
       */
      readonly config: Moli.MoliConfig;

      /**
       * stores the information if the moli ad tag is configured yet
       */
      readonly initialized: Promise<Moli.MoliConfig>;

      /**
       * the current href. The ad tag checks that `requestAds()` is only called once
       * per href otherwise it will throw an error as `requestAds()` is only allowed
       * once per page.
       */
      readonly href: string;
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
    export type BeforeRequestAdsHook = (config: Moli.MoliConfig) => void;

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

  export interface MoliConfig {
    /**
     * Configure the environment the ad tag should use.
     *
     * The default environment is `production` as we have a very conservative way of deploying
     * applications.
     *
     * default: 'production'
     * @see [[Environment]]
     */
    readonly environment?: Environment;

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

    consent?: consent.ConsentConfig;

    /** optional prebid configuration */
    readonly prebid?: headerbidding.PrebidConfig;

    /** Amazon A9 headerbidding configuration */
    readonly a9?: headerbidding.A9Config;

    /**
     * Configure optimization through the global auction context
     */
    readonly globalAuctionContext?: auction.GlobalAuctionContextConfig;

    readonly modules?: modules.ModulesConfig;

    /**
     * Reporting configuration
     */
    reporting?: reporting.ReportingConfig;

    /**
     * AdPipeline configuration
     */
    pipeline?: pipeline.PipelineConfig;

    /**
     * Configure bucketing behaviour
     */
    buckets?: bucket.GlobalBucketConfig;

    /** configurable logger */
    logger?: MoliLogger;

    /**
     * Google Publisher Tag configuration
     */
    readonly gpt?: {
      /**
       * GPT page settings configuration.
       */
      pageSettingsConfig?: googletag.GptPageSettingsConfig;
    };
  }

  /**
   * Add targeting information from the ad tag. Usually these are static values.
   * Dynamic values should be added via the MoliTag API `setTargeting(key, value)` or `addLabel(label)`.
   */

  export type AdUnitPathVariables = {
    [key: string]: string;
  };

  /**
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

  export interface Targeting {
    /** static or supplied key-values */
    readonly keyValues: DfpKeyValueMap;

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
   * Default cleanup behaviour for single page applications.
   * All slots are being destroyed on navigation.
   */
  export interface SinglePageAppCleanupConfigAll {
    readonly slots: 'all';
  }

  /**
   * This cleanup configuration destroys only the ad slots that are requested after navigation.
   * Replacement for the old `destroyAllAdSlots` setting.
   *
   * It allows publishers to keep all ad slots alive on navigation and only destroy the ones
   * that are requested.
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
   */
  export interface SinglePageAppCleanupConfigRequested {
    readonly slots: 'requested';
  }

  /**
   * This cleanup configuration allows publishers to select which ad slots should not be destroyed
   * on navigation. Currently only the `excluded` option is supported, which means that all ad slots
   * are destroyed on navigation, except the ones listed in `slotIds`.
   *
   * ## Use cases
   *
   * There are a couple of use cases for this setting.
   *
   * ### Static out-of-content ad slots
   *
   * Sidebars or sticky footers that are always present are handled by the regular ad reload.
   * Especially if the user navigates a lot on the page, e.g. swiping through images or profiles,
   * this leads to a better user experience and advertiser performance as ad refreshing is less frequent.
   *
   * ### Render on navigation slots like interstitials
   *
   * Certain slots are rendered on navigation, e.g. interstitials that are shown on navigation.
   * Those slots should not be destroyed on navigation, to be able to render them properly.
   */
  export interface SinglePageAppCleanupConfigSelected {
    /**
     * excluded: a list of ad slots that should not be destroyed on navigation.
     *
     * Note: This might be extended the future to support including only certain slots.
     */
    readonly slots: 'excluded';
    /**
     * A list of ad slot IDs that should not be destroyed on navigation.
     */
    readonly slotIds: string[];
  }

  export type SinglePageAppCleanupConfig =
    | SinglePageAppCleanupConfigAll
    | SinglePageAppCleanupConfigRequested
    | SinglePageAppCleanupConfigSelected;

  /**
   * Additional configuration for single page application publishers.
   */
  export interface SinglePageAppConfig {
    /**
     * Set to true if this publisher has a single page application.
     */
    readonly enabled: boolean;

    /**
     * Defines the cleanup behaviour on navigation.
     */
    readonly cleanup?: SinglePageAppCleanupConfig;

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
    readonly sizesSupported: DfpSlotSize[];
  }

  export interface LabelSizeConfigEntry {
    /** media query that must match if the labels are applicable */
    readonly mediaQuery: string;

    /** labels that are available if the media query matches */
    readonly labelsSupported: string[];
  }

  export type IPosition =
    | 'in-page'
    | 'interstitial'
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
    readonly sizes: DfpSlotSize[];

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
    readonly gpt?: googletag.GptSlotSettingsConfig & gpt.GptAdSlotConfig;

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

  export type FilterSupportedSizes = (givenSizes: DfpSlotSize[]) => DfpSlotSize[];

  /**
   * Combines the moli slot configuration (`Moli.AdSlot`) along with the actual `googletag.IAdSlot` definition.
   *
   * This model lets you work with the materialized slot (`googletag.IAdSlot`), while having access to the
   * configuration settings from the `Moli.AdSlot` definition.
   *
   * It also contains meta information that are being added in the `prepareRequestAds` phase.
   */
  export interface SlotDefinition<S extends Moli.AdSlot = Moli.AdSlot> {
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
      /**
       * optional list of ad dom ids that should be included in the ad request throttling
       * if not set, all ad slot requests will be throttled
       */
      includedDomIds?: string[];
    }

    /**
     * How many requestAds calls are needed before the configured ad slot can be requested
     */
    export interface PositionFrequencyConfigDelay {
      readonly minRequestAds: number;
    }

    /**
     * how many impressions are allowed in the defined interval for the configured ad slot.
     */
    export interface PositionFrequencyConfigPacingInterval {
      readonly maxImpressions: number;
      readonly intervalInMs: number;
    }

    /**
     *  how many requestAds call need to be between two winning impressions before the configured
     *  ad slot can be requested again.
     */
    export interface PositionFrequencyConfigPacingRequestAds {
      readonly requestAds: number;
    }

    /**
     * Limit the number of ad requests for a specific ad slot that can be made per requestAds cycle.
     * This is useful for high impact ad slots that should not be requested too often, e.g. interstitials, wallpapers
     * or video ads.
     *
     * Note that this frequency cap does not care if an impression was delivered or not.
     */
    export interface PositionFrequencyConfigAdRequestLimit {
      /**
       * Setting this to `1`means that only one ad request is allowed per requestAds cycle, which
       * translates to one ad request per page view.
       */
      readonly maxAdRequests: number;
    }

    /**
     * A set of possible conditions that all need to be met before the ad slot can request ads.
     */
    export interface PositionFrequencyConfigConditions {
      readonly delay?: PositionFrequencyConfigDelay;
      readonly pacingInterval?: PositionFrequencyConfigPacingInterval;
      readonly pacingRequestAds?: PositionFrequencyConfigPacingRequestAds;
      readonly adRequestLimit?: PositionFrequencyConfigAdRequestLimit;
    }

    export interface PositionFrequencyConfig {
      /**
       * references the ad slot that should be frequency capped.
       *
       * The `domId` or `adUnitCode` doesn't work for all possible use cases, as the interstitial
       * and other out-of-page formats have an auto-generated domId at runtime by gpt.js
       */
      readonly adUnitPath: string;

      /**
       * all list of conditions that need to be met before the ad slot can request ads.
       */
      readonly conditions: PositionFrequencyConfigConditions;
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

      /**
       * Optional list of dom ids for positions that should never be disabled.
       */
      readonly excludedPositions?: string[];
    }

    /**
     * @deprecated in favor of BidderFrequencyCappingConfig
     */
    export interface BidderFrequencyConfig {
      /** bidder that should receive the frequency capping  */
      readonly bidder: string;
      /** domId of the slot that should receive the capping  */
      readonly domId: string;
      /** milliseconds until a bidder can become active again  */
      readonly blockedForMs: number;

      /**
       * Optional list of events that should trigger the frequency capping.
       * The main use case is to reduce requests for high impact formats like wallpaper or interstitials.
       *
       * The default is `['bidWon']` which means that the frequency capping is only triggered when a bid is won.
       * For an interstitial format (e.g. from visx) that should be optimized against the google web interstitial,
       * the `bidRequested` event should be added, so the user doesn't see two interstitial directly after each other.
       * This can happen if the first page view is a google web interstitial, because the visx interstitial was requested,
       * but no bid came back and the second page view display the google interstitial, while a visx interstitial is
       * requested directly after the google interstitial is closed.
       *
       * @default ['bidWon']
       */
      readonly events?: Array<'bidWon' | 'bidRequested'>;
    }

    /**
     * How many requestAds calls are needed before the configured ad slot can be requested
     */
    export interface BidderDelayConfig {
      readonly minRequestAds: number;
    }

    export interface BidderFrequencyConfigPacingInterval {
      /**
       * maximum number of impressions that are allowed in the defined interval for the configured bidder
       */
      readonly maxImpressions: number;

      /**
       * The interval in milliseconds in which the maximum impressions are allowed.
       * This is used to pace the bid requests for a specific bidder.
       */
      readonly intervalInMs: number;

      /**
       * Optional list of events that should trigger the frequency capping.
       * The main use case is to reduce requests for high impact formats like wallpaper or interstitials.
       *
       * The default is `['bidWon']` which means that the frequency capping is only triggered when a bid is won.
       * For an interstitial format (e.g. from visx) that should be optimized against the google web interstitial,
       * the `bidRequested` event should be added, so the user doesn't see two interstitial directly after each other.
       * This can happen if the first page view is a google web interstitial, because the visx interstitial was requested,
       * but no bid came back and the second page view display the google interstitial, while a visx interstitial is
       * requested directly after the google interstitial is closed.
       *
       * @default ['bidWon']
       */
      readonly events?: Array<'bidWon' | 'bidRequested'>;
    }

    export interface BidderFrequencyConfigConditions {
      /**
       * How many requestAds calls are needed before the configured ad slot can be requested
       */
      readonly delay?: BidderDelayConfig;

      /**
       * how many impressions are allowed in the defined interval for the configured ad slot.
       */
      readonly pacingInterval?: BidderFrequencyConfigPacingInterval;
    }

    export interface BidderFrequencyCappingConfig {
      /**
       * bidders that should be frequency capped.
       *
       * If not set or empty, all bidders that are configured for this ad slot will be frequency capped.
       */
      readonly bidders?: string[];

      /** domId of the slot that should receive the capping  */
      readonly domId: string;

      /**
       * The conditions that need to be met before the bidder can request ads again.
       */
      readonly conditions: BidderFrequencyConfigConditions;
    }

    export interface FrequencyCappingConfig {
      /** enable or disable this feature */
      readonly enabled: boolean;
      /**
       * capping configuration for bidders and positions.
       * @deprecated in favor of `bidders` and `positions`
       */
      readonly configs?: BidderFrequencyConfig[];

      /** capping configuration for bidders and positions */
      readonly bidders?: BidderFrequencyCappingConfig[];

      /**
       * capping configuration for positions only.
       *
       * This mirrors general ad manager frequency capping and is useful for positions that have a
       * high impact on the user experience and thus should be reduced in frequency.
       */
      readonly positions?: PositionFrequencyConfig[];

      /**
       * If frequency capping state should be persisted into session storage.
       *
       * This is necessary for SSR pages, but should be disabled for SPA pages as no real page reload
       * is happening there.
       *
       * @default false
       */
      readonly persistent?: boolean;
    }

    export interface PreviousBidCpmsConfig {
      /** enable or disable this feature */
      readonly enabled: boolean;
    }

    /**
     * ## Interstitial channels
     *
     * A channel is the type of integration, which the ad will be rendered through.
     *
     * - `gam`: The interstitial ad is rendered through the Google Ad Manager Web Interstitials.
     * - `c`: The interstitial ad is rendered through custom a custom ad tag configuration, which
     *        could be a header bidding interstitial or a custom implementation.
     *
     */
    export type InterstitialChannel = 'gam' | 'c';

    /**
     * ## Interstitial Config
     *
     * The global auction context can add additional behaviour to the interstitial ad format through
     * this extension.
     *
     * Note that this does not replace, but extend the frequency capping feature. While the frequency
     * capping is used to limit the overall number of interstitials displayed to a user, this
     * configuration is used to control the order and types of channels and interstitial may be requested.
     */
    export interface InterstitialConfig {
      readonly enabled: boolean;

      /**
       * The ad unit path for the interstitial ad slot.
       * This is used to identify the interstitial ad slot in the ad server.
       */
      readonly adUnitPath: string;

      /**
       * The DOM ID of the interstitial ad slot.
       *
       * The Google Web Interstitials use a dynamic DOM ID that is generated at runtime, but all
       * other integrations require a DOM ID to properly perform an auction.
       */
      readonly domId: string;

      /**
       * The channels that are allowed to be used for the interstitial ad format and in which order
       * they should be requested.
       *
       * Duplicate channels are not allowed. After the first appearance of a channel, all subsequent
       * appearances are ignored.
       *
       * If the priority is empty, the interstitial ad format will not be requested at all.
       */
      readonly priority: InterstitialChannel[];

      /**
       * Time-to-live in milliseconds for the interstitial state stored in local storage.
       *
       * This value can influence the priority of the interstitial ad format as a channel might get
       * more share of ad requests if the interstitial state is not cleared frequently or cleared too
       * frequently.
       *
       * @default is 30 minutes
       */
      readonly ttlStorage?: number;
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

      /**
       * Set frequency capping for a specific slot and bidder
       */
      readonly frequencyCap?: FrequencyCappingConfig;

      /**
       * Save previous prebid bid cpms on this position
       */
      readonly previousBidCpms?: PreviousBidCpmsConfig;

      /**
       * Additional configuration options for the interstitial ad format.
       *
       * - Set priorities which channel ( gam web interstitial or custom interstitial )
       * - Configure waterfall scenarios for the interstitial ad format "gam > custom" or "custom > gam"
       */
      readonly interstitial?: InterstitialConfig;
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
       * buckets. The easiest way is to use the `moli.refreshBucket` API.
       *
       * ## Device specific buckets
       *
       * Instead of a single bucket name, it's possible to configure different buckets for desktop and mobile.
       * This is especially useful for certain ad slots that always need to be requested together for roadblocking, such
       * as wallpaper/skin ads, interstitials, or other high-impact formats.
       *
       * @see [[bucket.GlobalBucketConfig]]
       */
      readonly bucket?: bucket.AdSlotBucket;
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
     */
    export interface Infinite extends ISlotLoading {
      readonly loaded: 'infinite';

      /** deprecated  */
      readonly selector?: string;
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
    export type PrebidAdSlotConfigProvider =
      | PrebidAdSlotConfig
      | PrebidAdSlotConfig[]
      | ((context: PrebidAdSlotContext) => PrebidAdSlotConfig)
      | ((context: PrebidAdSlotContext) => PrebidAdSlotConfig[]);

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
      readonly keyValues: DfpKeyValueMap;
    }

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
      listener?: PrebidListenerProvider;

      /** External prebid distribution url */
      readonly distributionUrl?: string;

      /**
       * If set to true, the prebid auction will be clear on every `requestAds` call.
       * This can be useful in single page applications where the ad slots are reused.
       *
       * By default, this is false and the prebid auction will not be cleared.
       * Make sure if you enable this, to monitor the impact.
       *
       * @default false
       */
      readonly clearAllAuctions?: boolean;
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
       * Disable Amazon TAM / A9 integration
       * @default true
       */
      readonly enabled?: boolean;

      /**
       * Add conditions to disable a9 for certain pages.
       * Note that this is a global setting and will disable a9 for all ad slots.
       *
       * NOTE: single page applications are not supported yet. The aps script is loaded initially.
       *       If the first page view does not load the aps script, it will never be loaded for the
       *       entire session.
       */
      readonly labelAll?: string[];

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
      readonly supportedSizes?: DfpSlotSize[];

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
      readonly schainNode?: SupplyChainObject.ISupplyChainNode;
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

  export namespace pipeline {
    /**
     * ## Pipeline Config
     *
     * The AdPipeline is the driving data structure behind every ad request. It executes a set of steps in various
     * phases. This additional configuration lets the publisher or modules add new steps to the pipeline.
     *
     */
    export interface PipelineConfig {
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
     *
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
    export type MetricType =
      | 'cmpLoad'
      | 'dfpLoad'
      | 'prebidLoad'
      | 'a9Load'
      | 'ttfa'
      | 'ttfr'
      | 'adSlot'
      | 'adSlots';

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
      readonly measurement: PerformanceEntry;
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
       * Viewable in ad manager: https://admanager.google.com/[publisherId]#admin/companyDetail/id=[advertiserId]
       */
      readonly advertiserId?: number;

      /**
       * Campaign ID (Order ID) of the rendered ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/[publisherId]#delivery/OrderDetail/orderId=[campaignId]
       */
      readonly campaignId?: number;

      /**
       * Line item ID of the rendered reservation ad. Value is null for empty slots, backfill ads or creatives rendered
       * by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/[publisherId]#delivery/LineItemDetail/orderId=[campaignId]&lineItemId=[lineItemId]
       */
      readonly lineItemId?: number;

      /**
       * Performance mark when the ad slot is refreshed.
       */
      readonly refresh: PerformanceEntry;

      /**
       * Performance measure from `requestAds` until the adslot is rendered.
       */
      readonly rendered: PerformanceEntry;

      /**
       * Performance measure from `requestAds` until the adslot is fully loaded.
       */
      readonly loaded: PerformanceEntry;

      /**
       * Performance measure from `adSlot rendered` to `adSlot loaded`. This give
       * represents the time the creative needed to be fully visible.
       */
      readonly rendering: PerformanceEntry;
    }
  }

  export namespace bucket {
    /**
     * The bucket name for an ad slot. Can be a string (just the name of the bucket) or an object that
     * can contain buckets for each device type.
     */
    export type AdSlotBucket = string | Partial<Record<Device, string>>;

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
   * == Yield Optimization ==
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
       * The cpm in cents is used when "previous bid cpms" is enabled in the global auction context and the floor price is set dynamically.
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
    moli: Moli.MoliTag;
  };
}
