import { googletag } from './googletag';
import { prebidjs } from './prebidjs';
import { IModule, ModuleMeta } from './module';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../ads/adPipeline';
import { apstag } from './apstag';

export namespace Moli {
  export type DfpSlotSize = [number, number] | 'fluid';

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
   * `requestAds()` immedetialy after being loaded, publishers can customize the integration.
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
     * Set prebid first party data. Will be used by supporting bid adapters to enhance targeting
     * for the current page.
     * @param fpData
     */
    setFirstPartyData(fpData: prebidjs.firstpartydata.PrebidFirstPartyData): void;

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
     * @example On navigation change execute
     * ```
     * window.moli = window.moli || { que: [] };
     * window.moli.que.push(function(moliAdTag) {
     *   moliAdTag.requestAds()
     * });
     * ```
     *
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
     * @param domId - identifies the ad slot or ad slots
     */
    refreshAdSlot(domId: string | string[]): Promise<'queued' | 'refreshed'>;

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
  }

  /**
   *
   * ## State transitions
   *
   * The state machine is defined as:
   *
   * <pre style="font-size:10px;">
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
   * In this state the ad tag allows to call `requestAds()` multiple times. The ad tag state will
   * remain `spa` if there are no errors. Note that `requestAds()` call is only allowed if the
   * `window.location.href` has changed. This is a saftey guard against unwanted ad fraud behaviour.
   *
   * KeyValues and Labels are handled depending on their source:
   *
   * - keyValues and labels from the static configuration shipped with the ad tag persist.
   * - keyValues and labels configured via `setTargeting(...)` and `addLabel(...)` are only valid
   *   for the next `requestAds()` call and will be cleaned afterwards.
   *
   *
   * Supported loading behaviours are `eager` and `lazy-refreshable`. You should use `lazy refreshable`
   * for slots that are part of a component that is rendered after the dom is ready.
   *
   * #### Integration
   *
   * Single page applications are quite more complex than purely server-side-rendered websites. We have
   * a set of APIs at our disposal to deal with that.
   *
   * There are a three slot configurations we need to handle
   *
   * 1. slots that are **server-side rendered** and never removed. Examples for this are header area slots
   *    that are part of the generic page layout that does not change on any page.
   *    *Configuration:* Use the `eager` loading behaviour.
   * 2. slots that are **server-side rendered**, but may dis- and reappear in the spa context.
   *    *Configuration:* Use the `lazy refreshable` loading behaviour.
   * 3. slots that are rendered by the SPA.
   *    *Configuration:* Use the `lazy refreshable` loading behaviour.
   *
   *
   * Eager slots (configuration 1) don't need any special handling as the DOM element is present when the
   * site is being delivered and everything works as if it weren't a single page app.
   *
   * The `lazy refreshable` slots need a deeper integration. Conceptually the necessary calls look like this
   *
   * 1. Initial page load
   *    1. configure moli anywhere you want. Call `moli.requestAds()`
   *    2. the component did mount in the DOM. Then fire the event that the refreshable slot can be loaded
   * 2. Page navigation
   *    1. after navigation change call `moli.requestAds()`
   *    2. the component did mount in the DOM. Then fire the event that the refreshable slot can be loaded
   *
   * While this is the sequential order we want things to be executed, this isn't the case in reality. Mounting
   * in the DOM can appear before the `requestAds()` call has succesfully configured all event listeners, leading
   * to events not being received and ads not being shown.
   *
   * We will provide a few examples on how to solve this in major SPA frameworks.
   *
   * ##### React Example
   *
   * Dependencies
   * - [react](https://reactjs.org/) as SPA framework
   * - [react-router](https://reacttraining.com/react-router/web/guides/quick-start) for routing
   * - [history](https://github.com/ReactTraining/history) for browser history management
   *
   * The idea:
   * - Provide a [React Context](https://reactjs.org/docs/context.html), e.g. `RequestAdsContext`, that contains a
   *   flag if requestAds has already finished
   * - use the `history.listen` method to `requestAds()` on navigation changes and update the `RequestAdsContext`
   * - use the `moli.afterRequestAds(hook)` hook to react when the ad tag has configured everything and update the `RequestAdsContext`
   * - managed the trigger event firing in each component
   *
   * If you need example source code, just ask :)
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
       * Prebid first party data. Will be used by supporting prebid adapters to enhance targeting
       * for the current page. Set with
       *
       * @example
       * window.moli.que.push(function(moli) => {
       *   moli.setFirstPartyData(firstPartyData);
       * });
       */
      prebidFpData: prebidjs.firstpartydata.PrebidFirstPartyData;

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
       * Prebid first party data. Will be used by supporting prebid adapters to enhance targeting
       * for the current page. Set with
       *
       * @example
       * window.moli.que.push(function(moli) => {
       *   moli.setFirstPartyData(firstPartyData);
       * });
       */
      prebidFpData: prebidjs.firstpartydata.PrebidFirstPartyData;

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

      /**
       * Hooks configured by the user
       */
      hooks: IHooks;

      /**
       * A list of ad slots that should be refreshed
       */
      readonly refreshSlots: string[];

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
      readonly beforeRequestAds: Array<(config: Moli.MoliConfig) => void>;

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
     * The default environment is `production` as a we have a very conservative way of deploying
     * applications.
     *
     * default: 'production'
     * @see [[Environment]]
     */
    readonly environment?: Environment;

    /** all possible ad slots */
    readonly slots: AdSlot[];

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

    /** optional prebid configuration */
    readonly prebid?: headerbidding.PrebidConfig;

    /** Amazon A9 headerbidding configuration */
    readonly a9?: headerbidding.A9Config;

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
    buckets?: bucket.BucketConfig;

    /** configurable logger */
    logger?: MoliLogger;
  }

  /**
   * Add targeting information from the ad tag. Usually these are static values.
   * Dynamic values should be added via the MoliTag API `setTargeting(key, value)` or `addLabel(label)`.
   */
  export interface Targeting {
    /** static or supplied key-values */
    readonly keyValues: DfpKeyValueMap;

    /** additional labels. Added in addition to the ones created by the sizeConfig. */
    readonly labels?: string[];
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

    /** optional array of labels. All labels must be present if the sizes should be applied */
    readonly labelAll?: string[];

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
     * However this information is not passed to prebid. The ad tag already takes
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
     *
     * ```
     * var passbackCallback = function() {
     *   var request = JSON.stringify({
     *     type: 'passback',
     *     domId: '[AD-SLOT-DOM-ID]',
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
    export interface ISlotLoading {
      readonly loaded: 'eager' | 'lazy' | 'refreshable' | 'manual';

      /**
       * Defines a bucket in which this slot should be loaded. This allows to publishers to configured a set of ad
       * slots that should run in a separate auction. This can have positive revenue impacts on some prebid partners
       * that bid poorly if too many placements are requested at once.
       *
       * Even though this property is available on all loading behaviours only `eager` and `refreshable` with
       * `lazy: false` have an effect as these are loaded immediately.
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
     * An ad slot which is requested lazily.
     * DFP offers a similar implementation, but only for "load when in view port"
     */
    export interface Lazy extends ISlotLoading {
      readonly loaded: 'lazy';

      /** what triggers the loading */
      readonly trigger: Trigger;
    }

    /**
     * An ad slot which can be refreshed.
     * Useful for
     * - sorting lists that contain ads
     * - Single page applications (SPA)
     */
    export interface Refreshable extends ISlotLoading {
      readonly loaded: 'refreshable';

      /** what triggers the loading */
      readonly trigger: Trigger;

      /**
       * Configure the refresh behaviour.
       *
       * - `false` (default)
       *    the ad slot is refreshed instantly, acting like an eager loading slot
       * - `true`
       *    the ad slot is refreshed (requested) when the first event is fired, acting like a lazy loading slot
       */
      readonly lazy?: boolean;

      /**
       * Option throttle delay in seconds.
       *
       * The slot can be refresh at most once in the specified throttle time (seconds).
       * If no `throttle` duration is specified the slot can be unconditionally refreshed.
       */
      readonly throttle?: number;
    }

    /**
     * all available slot loading behaviours.
     */
    export type SlotLoading = Eager | Manual | Lazy | Refreshable;

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
     * const checkForJustPremiumWallpaper = (bidResponses: prebidjs.IBidResponseMap): boolean => {
     *   const wallpaperAdSlot = bidResponses['ad-wallpaper']; // select the ad slot by using the DOM ID
     *   // if available during this request
     *   if (wallpaperAdSlot) {
     *      return wallpaperAdSlot.bids.filter((bidResponse: prebidjs.BidREsponse) => {
     *          return bidResponse.bidder == 'justpremium' && bidResponse.format == 'wp' && bidResponse.cpm > 0
     *      }).length !== 0;
     *   }
     *   return false;
     * }
     *
     * const prebidListener = {
     *   preSetTargetingForGPTAsync: (bidResponses: prebidjs.IBidResponsesMap, timedOut: boolean, slotDefinitions: SlotDefinition<AdSlot>[]) => {
     *     if (this.checkForJustPremiumWallpaper(bidResponses)) {
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

    export interface PrebidConfig {
      /** https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig  */
      readonly config: prebidjs.IPrebidJsConfig;

      /** optional bidder settings */
      readonly bidderSettings?: prebidjs.IBidderSettings;

      /** optional listener for prebid events */
      listener?: PrebidListenerProvider;

      /**
       * Configure the user sync behaviour of prebid. Note that you always need to configure
       * the prebid `userSync.enableOverride` to `true` otherwise this won't have any effect
       * and the default prebid behaviour will be used instead.       *
       *
       * - 'all-ads-loaded' - triggers the user sync after all instantly loaded prebid ads are rendered
       *
       * default: prebid defaults (after 6 seconds delay)
       *
       * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
       */
      readonly userSync?: 'all-ads-loaded';
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
      readonly supportedSizes?: DfpSlotSize[];

      /**
       * Configure the Amazon _Publisher Audiences_ feature.
       */
      readonly publisherAudience?: A9PublisherAudienceConfig;
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
     * It possible to bucket ad slots with higher priority.
     * NOTE: there's no feature for delay or prioritization yet!
     *
     */
    export interface BucketConfig {
      /**
       * if set to true, ad slots will be loaded in buckets as specified in the
       * ad slot configuration.
       *
       * Default: false
       */
      readonly enabled: boolean;
    }
  }

  /**
   * == Yield Optimization ==
   *
   * The systems is designed to work with Google Ad Managers _Unified Pricing Rules_. The general idea is that
   * key values are being used to target specific pricing rules per ad unit. The configuration when a pricing rule
   * should be applied can be fetched from an external system to allow dynamic floor price optimizations.
   *
   * @see https://support.google.com/admanager/answer/9298008?hl=en
   * @see yield optimization module
   */
  export namespace yield_optimization {
    export interface PriceRule {
      /**
       * Unique identifier for a pricing rule. This is will be sent as a key_value `upr_id` per ad unit
       * and will trigger the matching unified pricing rule in Google Ad Manager.
       */
      readonly priceRuleId: number;

      /**
       * The model used to determine the price rule
       *
       * - `static`: fixed price rules in A/B test
       * - `ml`: super clever machine learning
       *
       * If none is provided `static` is used as a fallback
       */
      readonly model?: 'static' | 'ml';

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
    moli: Moli.MoliTag;
  };
}
