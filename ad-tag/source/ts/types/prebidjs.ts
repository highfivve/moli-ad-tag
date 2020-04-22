/**
 * Api Reference for Prebid.js
 *
 * @see https://prebid.org/dev-docs/publisher-api-reference.html
 */


export namespace prebidjs {

  export interface IPrebidJs {

    /**
     * Command queue on the `pbjs` window object.
     * All functions will be executed once pbjs is loaded.
     */
    que: {
      push(callback: Function): void;
    };

    /**
     * Prebid version
     */
    readonly version: string;


    /**
     * The bidderSettings object provides a way to define some behaviors for the platform and specific adapters.
     * The basic structure is a ‘standard’ section with defaults for all adapters, and then one or more
     * adapter-specific sections that override behavior for that bidder.
     */
    bidderSettings: IBidderSettings;

    /**
     * Contains all currently active ad units.
     *
     * NOTE: this is an undocumented API and is only used to remove adUnits in a single page application
     *       environment. If you upgrade prebid, make sure this API is still available.
     *
     * Works with prebid 1.38.0
     */
    readonly adUnits?: IAdUnit[];

    /**
     * Define ad units and their corresponding header bidding bidders' tag IDs.
     */
    addAdUnits(adUnits: IAdUnit[]): void;

    /**
     * Remove adUnit from the pbjs configuration
     *
     * @param adUnitCode - the adUnitCode to remove
     */
    removeAdUnit(adUnitCode: string): void;

    /**
     * Set query string targeting on all GPT ad units. The logic for deciding query strings is described
     * in the section Configure AdServer Targeting. Note that this function has to be called after all
     * ad units on page are defined.
     *
     * @param adUnit - an array of adUnitCodes to set targeting for. If no array is specified all configured
     *                 ad units will be used instead.
     *                 The parameter is especially useful for lazy loading, e.g. when the targeting needs to be set
     *                 for a specific ad unit that gets called lazily.
     */
    setTargetingForGPTAsync(adUnit?: string[]): void;

    /**
     *
     * supports a number of advanced configuration options
     *
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
     * @param {prebidjs.IPrebidJsConfig} config
     */
    setConfig(config: IPrebidJsConfig): void;

    /**
     * Request bids. When adUnits or adUnitCodes are not specified, request bids for all ad units added.
     */
    requestBids(requestParam?: IRequestObj): void;

    /**
     * This function returns the query string targeting parameters available at this moment for a given ad unit.
     */
    getAdserverTargeting(): object;

    /**
     * Trigger a manual user sync. This only works if you have set the `config.userSync.enableOverride` to `true`.
     *
     * http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
     */
    triggerUserSyncs(): void;

    /**
     * Enable sending analytics data to the analytics provider of your choice.
     *
     * For usage, see Integrate with the [Prebid Analytics API](http://prebid.org/dev-docs/integrate-with-the-prebid-analytics-api.html)
     *
     * @param adapters
     * @see [[http://prebid.org/overview/analytics.html]]
     * @see [[http://prebid.org/dev-docs/integrate-with-the-prebid-analytics-api.html]]
     */
    enableAnalytics(adapters: analytics.AnalyticsAdapter[]): void;

  }

  /**
   * ## Global Improve Digital configuration
   *
   * This extends the [[IPrebidJsConfig]] with Improve Digital specific configuration options.
   *
   */
  interface IImproveDigitalConfig {

    /**
     * Global Improve Digital property
     */
    readonly improvedigital?: {

      /**
       * Enable the single request mode, which will send all bids in one request.
       *
       * Available since prebid 1.37.0
       */
      readonly singleRequest: boolean;

      /**
       * By default, the adapter doesn’t send Prebid ad unit sizes to Improve Digital’s ad server
       * and the sizes defined for each placement in the Polaris platform will be used.
       *
       * This configuration makes improve use the prebid sizes parameter.
       *
       * Available since prebid 2.8.0
       */
      readonly usePrebidSizes: boolean;
    };
  }

  /**
   * 'Consent Management' module configuration
   *
   * @see https://prebid.org/dev-docs/modules/consentManagement.html
   */
  export namespace consent {

    export interface IConsentManagementConfig {
      /**
       * The ID for the CMP in use on the page. Default is 'iab'
       */
      readonly cmpApi?: 'iab';

      /**
       * Length of time (in milliseconds) to allow the CMP to perform its tasks before aborting the process. Default is 10000
       */
      readonly timeout: number;

      /**
       * A setting to determine what will happen when obtaining consent information from the CMP fails;
       * either allow the auction to proceed (true) or cancel the auction (false). Default is true
       */
      readonly allowAuctionWithoutConsent?: boolean;
    }
  }

  export namespace userSync {

    /**
     * ## Configure User Syncing
     *
     * The user sync configuration options described in this section give publishers control over how adapters behave
     * with respect to dropping pixels or scripts to cookie users with IDs. This practice is called “user syncing”
     * because the aim is to let the bidders match IDs between their cookie space and the DSP’s cookie space. There’s a
     * good reason for bidders to be doing this – DSPs are more likely to bid on impressions where they know something
     * about the history of the user. However, there are also good reasons why publishers may want to control the use of
     * these practices:
     *
     * - Page performance: Publishers may wish to move ad-related cookie work to much later in the page load after ads
     *                     and content have loaded.
     * - User privacy:     Some publishers may want to opt out of these practices even though it limits their users’
     *                     values on the open market.
     * - Security:         Publishers may want to control which bidders are trusted to inject images and JavaScript into
     *                     their pages.
     *
     * User syncing default behavior If you don’t tweak any of the settings described in this section, the default
     * behavior of Prebid.js is to wait 3 seconds after the auction ends, and then allow every adapter to drop up to
     * 5 image-based user syncs.
     *
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
     */
    export interface IUserSyncConfig {

      /**
       * Enable/disable the user syncing feature. Default: true.
       */
      readonly yncEnabled?: boolean;

      /**
       * Delay in milliseconds for syncing after the auction ends. Default: 3000.
       */
      readonly syncDelay?: number;

      /**
       * Number of registered syncs allowed per adapter. Default: 5. To allow all, set to 0.
       */
      readonly syncsPerBidder?: number;

      /**
       * Configure lists of adapters to include or exclude their user syncing based on the pixel type (image/iframe).
       */
      readonly filterSettings?: IFilterSettingsConfig;

      /**
       * Enable/disable publisher to trigger user syncs by calling pbjs.triggerUserSyncs(). Default: false.
       */
      readonly enableOverride?: boolean;
    }

    export interface IFilterSettingsConfig {
      /**
       * From the documentation:
       * If you want to apply the same bidder inclusion/exclusion rules for both types of sync pixels,
       * you can use the all object instead specifying both image and iframe objects like so
       */
      readonly all?: IFilterSetting;

      /**
       * Allow iframe-based syncs (the presence of a valid filterSettings.iframe object automatically enables iframe type user-syncing).
       *
       * Note - iframe-based syncing is disabled by default.
       */
      readonly iframe?: IFilterSetting;

      /**
       * Image-based syncing is enabled by default; it can be disabled by excluding all/certain bidders via the filterSettings object.
       */
      readonly image?: IFilterSetting;
    }

    export interface IFilterSetting {
      /**
       * Array of bidders that should be filtered. '*' means all.
       */
      readonly bidders: BidderCode[] | '*';

      readonly filter: 'include' | 'exclude';
    }

  }

  export namespace currency {

    export interface ICurrencyConfig {

      /**
       * ISO 4217 3-letter currency code.
       * If this value is present, the currency conversion feature is activated.
       */
      readonly adServerCurrency: 'EUR';

      /**
       * How much to scale the price granularity calculations. Defaults to 1.
       * Note: The multiplier may not make sense for markets
       * where the currency value is close to USD, e.g. GBP and EUR.
       * In those scenarios, just leave the granularityMultiplier at 1.
       */
      readonly granularityMultiplier: 1;

      /**
       * An optional parameter that defines a default rate that can be used
       * if the currency file cannot be loaded.
       * This option isn’t used when the rates parameter is supplied.
       *
       * Prebid hosts a conversion file here: https://currency.prebid.org/latest.json
       */
      readonly defaultRates: { 'USD': { 'EUR': number } };
    }
  }

  export namespace analytics {

    export type AnalyticsAdapter = IGoogleAnalyticsAdapter;
    export type AnalyticsProviders = 'ga';

    export interface IAnalyticsAdapter<T> {
      readonly provider: AnalyticsProviders;
      readonly options: T;
    }

    /**
     * Options are deducted from the source code.
     *
     * @see [[https://github.com/prebid/Prebid.js/blob/2.33.0/modules/googleAnalyticsAdapter.js]]
     */
    export interface IGoogleAnalyticsAdapterOptions {

      /**
       * set the global google analytics object if not 'ga'
       * default: 'ga'
       */
      readonly global?: string;

      /**
       * the google analytics tracker name
       * default: 'h5'
       */
      readonly trackerName?: string;


      /**
       * enable tracking of distribution metrics (load time, win rate)
       * default: false
       */
      readonly enableDistribution?: boolean;

      /**
       * define the percentage (0 to 1) of samples that should be tracked.
       *
       * 0   =   0%
       * 0.5 =  50%
       * 1   = 100%
       *
       * default: 100%
       */
      readonly sampling?: number;

    }

    export interface IGoogleAnalyticsAdapter extends IAnalyticsAdapter<IGoogleAnalyticsAdapterOptions> {
      readonly provider: 'ga';
    }

  }


  /**
   * ## Global Prebid Configuration
   *
   * Contains various configuration options for prebid. The type is not complete. Only the necessary configuration
   * options are listed here.
   *
   * NOTE: modules can extend this configuration as well, so you may find the information in various prebid
   *       documentation pages. One example is the consentModule.
   *
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
   */
  export interface IPrebidJsConfig extends IImproveDigitalConfig {

    /**
     * Turn on debugging
     */
    readonly debug?: boolean;

    /**
     * global bidder timeout
     */
    readonly bidderTimeout?: number;

    /**
     * After this method is called, Prebid.js will generate bid keywords for all bids, instead of the default behavior
     * of only sending the top winning bid to the ad server.
     *
     * With the sendAllBids mode enabled, your page can send all bid keywords to your ad server. Your ad server will see
     * all the bids, then make the ultimate decision on which one will win. Some ad servers, such as DFP, can then
     * generate reporting on historical bid prices from all bidders.
     *
     * Note that this config option must be called before pbjs.setTargetingForGPTAsync() or pbjs.getAdserverTargeting().
     *
     * After this option is set, pbjs.getAdserverTargeting() will give you the below JSON (example).
     * pbjs.setTargetingForGPTAsync() will apply the below keywords in the JSON to GPT (example below)
     *
     * Default: true
     */
    readonly enableSendAllBids?: boolean;

    /**
     * 'Consent Management' module configuration
     *
     * @see https://prebid.org/dev-docs/modules/consentManagement.html
     */
    readonly consentManagement?: consent.IConsentManagementConfig;

    /**
     * @see userSync.IUserSyncConfig
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
     */
    readonly userSync?: userSync.IUserSyncConfig;

    /**
     * The configuration for the currency module
     *
     * https://prebid.org/dev-docs/modules/currency.html
     */
    readonly currency: currency.ICurrencyConfig;
  }

  /**
   * For AdUnits with MediaType: banner
   */
  export interface IMediaTypeBanner {
    /**
     * All the sizes that this ad unit can accept.
     * Hint: Some SSPs handles only the first size, so keep that in mind.
     */
    readonly sizes: [ number, number ][];
  }

  /**
   * For AdUnits with MediaType: video
   */
  export interface IMediaTypeVideo {

    /**
     * Context can be 'instream' or 'outstream'.
     * We only show outstream videos. Outstream video ads can be shown on any web page.
     * Instream video ads require you to have your own video inventory.
     */
    readonly context: 'outstream';

    /**
     * Player size(s) that this ad unit can accept (width, height).
     */
    readonly playerSize: [ number, number ][] | [ number, number ];
  }

  /**
   * Defines one or multiple media types the ad unit supports.
   * Media Types can be "banner", "native" or "video.
   *
   * @see https://prebid.org/dev-docs/show-multi-format-ads.html
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#adUnit-multi-format
   */
  export interface IMediaTypes {

    /**
     * optional. If no other properties are specified, this is the default.
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#adUnit-banner
     */
    readonly banner?: IMediaTypeBanner;

    /**
     * Defines properties of a video ad.
     *
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#adUnit-video
     */
    readonly video?: IMediaTypeVideo;
  }

  /**
   * Prebid.js will select the renderer used to display the outstream video in the following way:
   *
   * 1. If a renderer is associated with the Prebid adUnit, it will be used to display any outstream demand
   *    associated with that adUnit. Below, we will provide an example of an adUnit with an associated renderer.
   * 2. If no renderer is specified on the Prebid adUnit, Prebid will invoke the renderer
   *    associated with the winning (or selected) demand partner video bid.
   *
   * Since not all demand partners return a renderer with their video bid responses,
   * we recommend that publishers associate a renderer with their Prebid video adUnits, if possible.
   *
   * @see https://prebid.org/dev-docs/show-outstream-video-ads.html
   */
  export interface IRenderer {
    /**
     * Points to a file containing the renderer script.
     */
    readonly url: string;
    /**
     * A function that tells Prebid.js how to invoke the renderer script.
     */
    readonly render: (bid: any) => void; // TODO: find out bid type

    /**
     * NOTE: we only want publishers that offer us url and renderer, but we want to keep this possibility open
     *
     * For demand partners that return a renderer with their video bid responses.
     * This configuration is bidder specific and may include options for e.g. skippability, player size and ad text.
     */
    readonly options?: any;
  }

  /**
   * ## Ad unit / ad unit object
   *
   * The ad unit object is where you configure what kinds of ads you will show in a given ad slot on your page, including:
   *
   * - Allowed sizes
   * - Allowed media types (e.g., banner, native, and/or video)
   *
   * It’s also where you will configure bidders, e.g.:
   *
   * - Which bidders are allowed to bid for that ad slot
   * - What information is passed to those bidders via their parameters
   *
   * Relates directly to the `Moli.IAdSlot`.
   *
   * @see https://prebid.org/dev-docs/adunit-reference.html
   */
  export interface IAdUnit {
    /**
     * A unique identifier that you create and assign to this ad unit. This identifier will be used to set
     * query string targeting on the ad. If you're using GPT, we recommend setting this to the slot element ID.
     */
    readonly code: string;

    /**
     * Defines one or multiple media types the ad unit supports.
     * Media Types can be "banner", "native" or "video
     */
    readonly mediaTypes: IMediaTypes;

    /**
     * An array of bid objects.
     */
    readonly bids: IBid[];

    /**
     * The renderer associated to the ad-unit. Only for mediaType = video.
     */
    readonly renderer?: IRenderer;
  }

  // Supported SSPs
  export const Criteo = 'criteo';
  export const AppNexusAst = 'appnexusAst';
  export const ImproveDigital = 'improvedigital';
  export const IndexExchange = 'ix';
  export const NanoInteractive = 'nanointeractive';
  export const JustPremium = 'justpremium';
  export const PubMatic = 'pubmatic';
  export const OpenX = 'openx';
  export const SmartAdServer = 'smartadserver';
  export const Unruly = 'unruly';
  export const Teads = 'teads';
  export const Yieldlab = 'yieldlab';
  export const Spotx = 'spotx';
  export const ShowHeroes = 'showheroesBs';
  export const Xaxis = 'xhb';
  export const DSPX = 'dspx';

  /**
   * The bidder code is used to identify the different SSPs.
   */
  export type BidderCode =
    typeof Criteo
    | typeof AppNexusAst
    | typeof ImproveDigital
    | typeof IndexExchange
    | typeof JustPremium
    | typeof NanoInteractive
    | typeof PubMatic
    | typeof OpenX
    | typeof SmartAdServer
    | typeof Unruly
    | typeof Teads
    | typeof Yieldlab
    | typeof Spotx
    | typeof ShowHeroes
    | typeof Xaxis
    | typeof DSPX;

  /**
   * A bid object.
   */
  export interface IBidObject<B extends BidderCode, T> {
    /**
     * Unique code identifying the bidder. For bidder codes, see the [bidder param reference](https://prebid.org/dev-docs/bidders.html).
     * @see https://prebid.org/dev-docs/bidders.html
     */
    readonly bidder: B;

    /**
     * Bid request parameters for a given bidder. For allowed params, see the [bidder param reference](https://prebid.org/dev-docs/bidders.html).
     * @see https://prebid.org/dev-docs/bidders.html
     */
    readonly params: T;

    /**
     * Used for [conditional ads](https://prebid.org/dev-docs/conditional-ad-units.html).
     * Works with sizeConfig argument to [pbjs.setConfig](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads).
     *
     * @see https://prebid.org/dev-docs/conditional-ad-units.html
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly labelAny?: string[];

    /**
     * Used for [conditional ads](https://prebid.org/dev-docs/conditional-ad-units.html).
     * Works with sizeConfig argument to [pbjs.setConfig](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads).
     *
     * @see https://prebid.org/dev-docs/conditional-ad-units.html
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly labelAll?: string[];
  }

  /**
   * Criteo bid parameters. There is no public available documentation. All information was
   * gathered from the prebid.js criteo adapter implementation.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/criteoBidAdapter.js
   */
  export interface ICriteoParams {

    /**
     * Included for legacy integrations that require a zone id.
     */
    readonly zoneId?: number;

    /**
     * Required for all new criteo implementations
     */
    readonly networkId: number;

    /**
     * Used for reporting: we use de div-id here.
     */
    readonly publisherSubId?: string;
  }

  export interface ICriteoBid extends IBidObject<typeof Criteo, ICriteoParams> {
  }

  export interface IAppNexusASTKeyword {
    [key: string]: string[];
  }

  /**
   * AppNexusAST bid parameters.
   *
   * The type definition may not be complete as only the actually used (or tested)
   * fields are being modelled in this definition.
   *
   * @see https://prebid.org/dev-docs/bidders.html#appnexusAst
   */
  export interface IAppNexusASTParams {

    /**
     * The placement ID from AppNexus. You may identify a placement using the `invCode`
     * and `member` instead of a placement ID.
     */
    readonly placementId: string;

    /**
     * If true, ads smaller than the values in your ad unit’s sizes array will be allowed to serve.
     * Defaults to false.
     */
    readonly allowSmallerSizes?: boolean;

    /**
     * A set of key-value pairs applied to all ad slots on the page.
     * Mapped to query string segments for buy-side targeting.
     *
     * Example:
     *
     * keywords: { genre: ['rock', 'pop'] }
     */
    readonly keywords?: IAppNexusASTKeyword;

    /**
     * Sets a floor price for the bid that is returned.
     */
    readonly reserve?: number;

    /**
     * Optional configuration for video placements
     * @see https://prebid.org/dev-docs/bidders.html#appnexus-video-object
     */
    readonly video?: {

      /**
       * Array of strings listing the content MIME types supported
       */
      readonly mimes?: string[];

      /**
       *  Integer that defines the minimum video ad duration in seconds.
       */
      readonly minduration?: number;

      /**
       * Integer that defines the maximum video ad duration in seconds.
       */
      readonly maxduration?: number;

      /**
       * Integer that determines whether to show the ad before, during, or after video content.
       * If > 0, position is mid-roll and value indicates start delay, in seconds.
       * Allowed values: Pre-roll: 0 (default); Mid-roll: -1 ; Post-roll: -2.
       */
      readonly startdelay?: number;

      /**
       * Boolean which, if true, means the user can click a button to skip the video ad.
       * Defaults to false.
       */
      readonly skippable?: boolean;

      /**
       * playback_method  Array of strings listing playback methods supported by the publisher.
       */
      readonly playback_method?: Array<'auto_play_sound_on' | 'auto_play_sound_off' | 'click_to_play' | 'mouseover' | 'auto_play_sound_unknown'>

      /**
       *  Array of integers listing API frameworks supported by the publisher.
       *  Allowed values:
       *    0: None
       *    1: VPAID 1.0
       *    2: VPAID 2.0
       *    3: MRAID 1.0:
       *    4: ORMMA
       *    5: MRAID 2.0
       */
      readonly frameworks?: Array<0 | 1 | 2 | 3 | 4 | 5>;
    };

  }

  /**
   * AppNexus bid object.
   */
  export interface IAppNexusASTBid extends IBidObject<typeof AppNexusAst, IAppNexusASTParams> {
  }

  /**
   * ImproveDigital bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/improvedigitalBidAdapter.js
   * @see https://prebid.org/dev-docs/bidders/improvedigital.html
   */
  export interface IImproveDigitalParams {
    readonly placementId: number;
    /**
     * Optional field to add additional targeting values.
     * Arbitrary keys can be added. The value is always a string array.
     */
    readonly keyValues?: {
      /** key value map */
      [key: string]: string[];
    };

    /**
     * Bid floor price
     *
     * @example 0.01
     */
    readonly bidFloor?: number;

    /**
     * Bid floor price currency. Supported values: USD (default), EUR, GBP, AUD, DKK, SEK, CZK, CHF, NOK
     */
    readonly bidFloorCur?: 'EUR';

  }

  /**
   * ImproveDigital bid object.
   */
  export interface IImproveDigitalBid extends IBidObject<typeof ImproveDigital, IImproveDigitalParams> {
  }

  /**
   * IndexExchange bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/indexExchangeBidAdapter.js
   * @see Documentation https://prebid.org/dev-docs/bidders/indexExchange.html
   */
  export interface IIndexExchangeParams {
    /**
     * An IX-specific identifier that is associated with a specific size on this ad unit. This is similar to
     * a placement ID or an ad unit ID that some other modules have.
     */
    readonly siteId: string;

    /**
     * The single size associated with the site ID. It should be one of the sizes listed in the ad unit under
     * `adUnits[].sizes` or `adUnits[].mediaTypes.banner.sizes`.
     *
     * Note that the ‘ix’ Prebid Server bid adapter ignores this parameter.
     */
    readonly size: [ number, number ];

    /**
     * Taken from source code:
     * @see https://github.com/prebid/Prebid.js/blob/3.9.0/modules/ixBidAdapter.js#L363-L371
     *
     * You must set the `bidFloorCur` parameter as well if you set this
     */
    readonly bidFloor?: number;

    /**
     * only required if the `bidFloor` parameter is set
     */
    readonly bidFloorCur?: 'EUR';
  }


  /**
   * IndexExchange bid object.
   */
  export interface IIndexExchangeBid extends IBidObject<typeof IndexExchange, IIndexExchangeParams> {
  }

  // ----- JustPremium ----- //

  export const JustPremiumPushUpBillboard = 'pu';
  export const JustPremiumPushDownBillboard = 'pd';
  export const JustPremiumFloorAd = 'fa';
  export const JustPremiumClassicFloorAd = 'cf';
  export const JustPremiumSideAd = 'sa';
  export const JustPremiumWallpaper = 'wp';
  export const JustPremiumMobileScroller = 'is';
  export const JustPremiumMobileSkin = 'mt';
  export const JustPremiumCascadeAd = 'ca';

  /**
   * The JustPremium HeaderBidding Guide offers a complete list of all formats.
   * This type only contains the formats in use.
   *
   * IMPORTANT: The format identifier is used by the prebid adapter to identify the correct adslot.
   *            AdUnit and DOM id are irrelevant. Make sure that the allow / exclude settings are
   *            unique for each ad slot. Otherwise only one ad slot will be filled, while the others
   *            stay empty.
   */
  export type JustPremiumFormat = typeof JustPremiumPushUpBillboard |
    typeof JustPremiumPushDownBillboard |
    typeof JustPremiumFloorAd |
    typeof JustPremiumClassicFloorAd |
    typeof JustPremiumSideAd |
    typeof JustPremiumWallpaper |
    typeof JustPremiumMobileScroller |
    typeof JustPremiumMobileSkin |
    typeof JustPremiumCascadeAd;

  /**
   * JustPremium bid parameters
   */
  export interface IJustPremiumParams {

    /**
     * The zone ID provided by JustPremium.
     */
    readonly zone: string;

    /**
     * Permits a publisher to decide which products can be run from a specific ad unit
     */
    readonly allow?: Array<JustPremiumFormat>;

    /**
     * Permits a publisher to decide which products should be excluded from running in specific ad unit
     */
    readonly exclude?: Array<JustPremiumFormat>;
  }

  export interface IJustPremiumBid extends IBidObject<typeof JustPremium, IJustPremiumParams> {
  }

  export interface IPubMaticParams {

    /**
     *
     */
    readonly publisherId: string;

    /**
     * The adslot definition encodes the ad slot name and size.
     *
     * Format : [adSlot name| adSlot id]@[width]x[height]
     * Example: pubmatic_test@300x250
     * Example: 123456@300x250
     */
    readonly adSlot: string;

    /**
     * Bid Floor
     *
     * @example '1.75'
     */
    readonly kadfloor?: string;

    /**
     * Bid currency
     * Value configured only in the 1st adunit will be passed on.
     * Values if present in subsequent adunits, will be ignored.
     */
    readonly currency?: 'EUR' | 'USD';
  }

  export interface IPubMaticBid extends IBidObject<typeof PubMatic, IPubMaticParams> {
  }

  /**
   * NanoInteractive bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/nanointeractiveBidAdapter.js
   */
  export interface INanoInteractiveParams {
    /* security code */
    readonly sec: string;
    /* data partner id */
    readonly dpid: string;
    /* pixel id */
    readonly pid: string;
    /* tags */
    readonly nq?: string;
    /* url query param name */
    readonly name?: string;
    /* marketing channel (tier1) */
    readonly category: string;
  }

  /**
   * NanoInteractive bid object.
   */
  export interface INanoInteractiveBid extends IBidObject<typeof NanoInteractive, INanoInteractiveParams> {
  }

  /**
   * OpenX bid parameters
   *
   * @see https://prebid.org/dev-docs/bidders/openx.html
   *
   */
  export interface IOpenxParams {
    /**
     * OpenX delivery domain provided by your OpenX representative.
     * example: "PUBLISHER-d.openx.net"
     */
    delDomain: string;

    /**
     * OpenX ad unit ID provided by your OpenX representative.
     * example: "1611023122"
     */
    unit: string;

    /**
     * Minimum price in `USD`. customFloor applies to a specific unit. For example,
     * use the following value to set a $1.50 floor: 1.50
     *
     * *WARNING:*
     * Misuse of this parameter can impact revenue
     */
    readonly customFloor?: number;
  }

  /**
   * OpenX bid object
   */
  export interface IOpenxBid extends IBidObject<typeof OpenX, IOpenxParams> {
  }

  /**
   * Smart bid parameters
   *
   * @see https://prebid.org/dev-docs/bidders/smartadserver.html
   *
   */
  export interface ISmartAdServerParams {
    /**
     * The network domain
     * example: "https://prg.smartadserver.com"
     */
    readonly domain: string;

    /**
     * The placement site ID
     * example: 1234
     */
    readonly siteId: number;

    /**
     * The placement page ID
     * examples: 1234
     */
    readonly pageId: number;

    /**
     *  The placement format ID
     *  example: 1234
     */
    readonly formatId: number;

    /**
     * Override the default currency code (ISO 4217) of the ad request. (Default: 'USD')
     */
    readonly currency?: 'EUR' | 'USD';

    /**
     * Bid floor for this placement in USD or in the currency specified by the currency parameter. (Default: 0.0)
     */
    readonly bidfloor?: number;

  }

  /**
   * Smart bid object
   */
  export interface ISmartAdServerBid extends IBidObject<typeof SmartAdServer, ISmartAdServerParams> {
  }

  /**
   * Unruly bid parameters
   *
   * @see https://prebid.org/dev-docs/bidders#unruly
   */
  export interface IUnrulyParams {

    /**
     * The site ID from Unruly.
     */
    siteId: number;

    /**
     * The targeting UUID from Unruly.
     */
    targetingUUID: string;
  }

  /**
   * Unruly bid object
   */
  export interface IUnrulyBid extends IBidObject<typeof Unruly, IUnrulyParams> {
  }

  /**
   * Teads bid parameters
   *
   * @see https://prebid.org/dev-docs/bidders#teads
   */
  export interface ITeadsParams {

    /**
     * Teads page id.
     */
    pageId: number;

    /**
     * Teads placement id.
     */
    placementId: number;
  }

  /**
   * Teads bid object
   */
  export interface ITeadsBid extends IBidObject<typeof Teads, ITeadsParams> {
  }

  export interface IYieldlabParams {

    /**
     * Yieldlab Adslot ID
     */
    readonly adslotId: string;

    /**
     * Yieldlab Supply ID. Please reach out to your account management for more information.
     */
    readonly supplyId: string;

    /**
     *  Override the default prebid size.
     *
     *  The current implementation takes the the first size from the sizes array and uses
     *  it. As we have a mulit-size setup, this doesn't work. So this parameter is required
     *  for us.
     *
     *  @example 970x250
     */
    readonly adSize: string;

    /**
     * A simple key-value map
     */
    readonly targeting?: { [key: string]: string };
  }

  /**
   * Yieldlab bid object
   */
  export interface IYieldlabBid extends IBidObject<typeof Yieldlab, IYieldlabParams> {
  }

  /**
   * Spotx bid parameters.
   *
   *
   * @see Implementation [[https://github.com/prebid/Prebid.js/blob/master/modules/spotxBidAdapter.js]]
   * @see Documentation [[https://prebid.org/dev-docs/bidders/spotx.html]]
   * @see Integration [[https://github.com/prebid/Prebid.js/pull/3472]]
   * @since Prebid `2.1.0`
   */
  export interface ISpotxParams {
    /**
     * A unique 5 digit ID that is generated by the SpotX publisher platform when a channel is created.
     *
     * @example `'85394'`
     */
    readonly channel_id: string;

    /**
     * Token that describes which ad unit to play: instream or outstream.
     *
     * @example `'outstream'`
     */
    readonly ad_unit: 'instream' | 'outstream';

    /**
     * Object to set options on the renderer.
     */
    readonly outstream_options: {
      /**
       * ID of element that video ad should be rendered into.
       *
       * @example `'adSlot1`'
       */
      readonly slot: string;

      /**
       * Boolean identifying whether the reqeusts should be https or not (used to override the protocol if the page isn't secure.
       */
      readonly secure?: boolean;

      /**
       * List of mimetypes to allow in ad.
       */
      readonly mimes?: Array<'application/javascript' | 'video/mp4' | 'video/webm' | 'application/x-shockwave-flash'>

      /**
       * Set to true to start the ad with the volume muted.
       */
      readonly ad_mute?: boolean;

      /**
       * Set to true to make video auto-adapt to the ad's dimensions
       */
      readonly playersize_auto_adapt?: boolean;

      /**
       * ID of iFrame element to insert EASI script tag.
       */
      readonly in_iframe?: string;

      /**
       * Object of script tag attributes to override from the list of EASI Attributes.
       *
       * @see [[https://developer.spotxchange.com/content/local/docs/sdkDocs/EASI/README.md#common-javascript-attributes]]
       */
      readonly custom_override?: {

        /**
         * Autoplay is the default behavior where 1=autoplay and 0=user or publisher initiated.
         */
        readonly autoplay?: 0 | 1;

        /**
         * The desired width of the video ad placement. Requires `content_height` to also be set.
         *
         * @example `'640'`
         */
        readonly content_width?: string;

        /**
         * The desired height of the video ad placement. Requires content_width to also be set.
         *
         * @example `'480'`
         */
        readonly content_height?: string;
      };
    };

    /**
     * Value between 0 and 1 to denote the volume the ad should start at.
     */
    readonly ad_volume?: number;


    /**
     * Set to true to hide the spotx skin
     */
    readonly hide_skin?: boolean;

    /**
     * Configure key-value targeting
     *
     * @see [[https://developer.spotxchange.com/content/local/docs/sdkDocs/DirectSdk/README.md#custom-property-for-key-value-pair-reporting]]
     */
    readonly custom?: { [key: string]: string | number | string[] };
  }

  /**
   * SpotX bid object.
   */
  export interface ISpotXBid extends IBidObject<typeof Spotx, ISpotxParams> {
  }

  export interface IShowHeroesParams {
    /**
     * ShowHeroes player ID
     * @example '0151f985-fb1a-4f37-bb26-cfc62e43ec05'
     */
    readonly playerId: string;

    /**
     * Vpaid wrapper
     *
     * default: `false`
     */
    readonly vpaidMode?: boolean;
  }

  /**
   * ShowHeroes bid object
   *
   * Request are being made to `https://bs1.showheroes.com/api/v1/bid`
   *
   * @see [[http://prebid.org/dev-docs/bidders/showheroes.html]]
   */
  export interface IShowHeroesBid extends IBidObject<typeof ShowHeroes, IShowHeroesParams> {
  }

  export interface IXaxisParams {
    /**
     * placement id
     */
    readonly placementId: string;
  }

  /**
   * Xaxis / GroupM bid object
   *
   * Request are being made to `https://ib.adnxs.com/ut/v3/prebid` (App Nexus Ad Server).
   *
   * `Deal ID` Ad Server Key: `hb_deal_xhb`
   *
   * @see [[http://prebid.org/dev-docs/bidders/xaxis.html]]
   */
  export interface IXaxisBid extends IBidObject<typeof Xaxis, IXaxisParams> {
  }

  export interface IDSPXParams {
    /**
     * placement id
     */
    readonly placement: string;

    /**
     * enables local development mode
     */
    readonly devMode?: boolean;

    /**
     * Selection filter
     */
    readonly pfilter?: {

      /**
       * floor price in EUR * 1.000.000
       */
      readonly floorprice?: number;

      /**
       * Is private auction?  0  - no, 1 - yes
       */
      readonly private_auction?: 0 | 1;
    };
  }

  /**
   * DSPX (Screen on Demand)
   *
   * Request are being made to `https://buyer.dspx.tv/request/`.
   * In dev mode requrest are being made to `https://dcbuyer.dspx.tv/request/`
   *
   *
   * @see [[https://prebid.org/dev-docs/bidders/dspx.html]]
   */
  export interface IDSPXBid extends IBidObject<typeof DSPX, IDSPXParams> {
  }

  /**
   * Supported bid object types.
   */
  export type IBid =
    ICriteoBid
    | IAppNexusASTBid
    | IImproveDigitalBid
    | IIndexExchangeBid
    | IJustPremiumBid
    | INanoInteractiveBid
    | IPubMaticBid
    | IOpenxBid
    | ISmartAdServerBid
    | IUnrulyBid
    | ITeadsBid
    | IYieldlabBid
    | ISpotXBid
    | IShowHeroesBid
    | IXaxisBid
    | IDSPXBid;

  /**
   * Request bids. When adUnits or adUnitCodes are not specified, request bids for all ad units added.
   */
  export interface IRequestObj {

    /**
     * adUnit codes to request. Use this or requestObj.adUnits
     */
    adUnitCodes?: string[];

    /**
     * AdUnitObjects to request. Use this or requestObj.adUnitCodes
     */
    adUnits?: string[];

    /**
     * Timeout for requesting the bids specified in milliseconds
     */
    readonly timeout?: number;

    /**
     *  Defines labels that may be matched on ad unit targeting conditions.
     */
    readonly labels: string[];

    /**
     * Callback to execute when all the bid responses are back or the timeout hits.
     * @param bidResponses contains all valid SSP responses
     * @param timedOut - true if the handler was called due to hitting the timeout. false others
     */
    readonly bidsBackHandler?: (bidResponses?: IBidResponsesMap, timedOut?: boolean) => void;
  }

  /**
   * The Object returned by the bidsBackHandler when requesting the Prebidjs bids.
   */
  export interface IBidResponsesMap {
    /**
     * The adUnit code, e.g. 'ad-presenter-desktop'
     */
    [adUnitCode: string]: {
      /**
       * The bids that were returned by prebid
       */
      bids: prebidjs.BidResponse[];
    } | undefined;
  }

  /**
   * Bid response object.
   *
   * ## Concrete BidResponse types
   *
   * You can add specific response types for every header bid if necessary by
   *
   * 1. Creating a new interface that extends IBidResponse
   * 2. Narrow the `bidder` property to the header bidder, e.g.
   *    readonly bidder: typeof JustPremium
   * 3. Add the interface to the `BidResponse` union type
   * 4. Match on the `bidder` (acts as the union discriminator) to get the specific response you want.
   *
   */
  export interface IBidResponse {
    /**
     * The bidder code.
     */
    readonly bidder: BidderCode;

    /**
     * The exact bid price from the bidder.
     */
    readonly cpm: number;

    /**
     * The unique identifier of a bid creative.
     */
    readonly adId: string;

    /**
     * The width of the returned creative size.
     */
    readonly width: number;

    /**
     * The height of the returned creative size.
     */
    readonly height: number;
  }

  export interface IGenericBidResponse extends IBidResponse {

    /**
     * The bidder code.
     *
     * Excludes all the bidder codes which have a more specific implementation.
     * Add more bidders by extending the union type, e.g.
     *
     * ```
     * Exclude<BidderCode, typeof JustPremium | typeof AppNexusAst>;
     * ```
     */
    readonly bidder: Exclude<BidderCode, typeof JustPremium>;
  }

  export interface IJustPremiumBidResponse extends IBidResponse {

    /**
     * narrow this bid response type to justpremium
     */
    readonly bidder: typeof JustPremium;

    /**
     * The format that justpremium wants to deliever
     */
    readonly format: JustPremiumFormat;
  }

  export type BidResponse = IGenericBidResponse | IJustPremiumBidResponse;

  /**
   * The bidderSettings object provides a way to define some behaviors for the platform
   * and specific adapters. The basic structure is a ‘standard’ section with defaults for
   * all adapters, and then one or more adapter-specific sections that override behavior
   * for that bidder.
   *
   * Defining bidderSettings is optional; the platform has default values for all of the options. Adapters may specify their own default settings, though this isn’t common. Some sample scenarios where publishers may wish to alter the default settings:
   *
   * - using bidder-specific ad server targeting instead of Prebid-standard targeting
   * - passing additional information to the ad server
   * - adjusting the bid CPM sent to the ad server
   *
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
   */
  export interface IBidderSettings {

    /** used as a fallback if the SSP has no custom bidder settings */
    readonly standard?: IBidderSetting;

    /** criteo bidder settings */
    readonly criteo?: IBidderSetting;

    /** appNexus bidder settings */
    readonly appnexusAst?: IBidderSetting;

    /** improveDigital bidder settings */
    readonly improvedigital?: IBidderSetting;

    /** indexExchange bidder settings */
    readonly ix?: IBidderSetting;

    /** nano interactive bidder settings */
    readonly nanoInteractive?: IBidderSetting;

    /** just premium bidder settings */
    readonly justpremium?: IBidderSetting;

    /** PubMatic bidder settings */
    readonly pubmatic?: IBidderSetting;

    /** OpenX bidder settings */
    readonly openx?: IBidderSetting;

    /** Smart AdServer bidder settings */
    readonly smartadserver?: IBidderSetting;

    /** unruly bidder settings */
    readonly unruly?: IBidderSetting;

    /** teads bidder settings */
    readonly teads?: IBidderSetting;

    /** yieldlab bidder settings */
    readonly yieldlab?: IBidderSetting;

    /** spotx bidder settings */
    readonly spotx?: IBidderSetting;

    /** xaxis xhb bidder settings */
    readonly xhb?: IBidderSetting;

    /** dspx bidder settings */
    readonly dpsx?: IBidderSetting;
  }

  /**
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
   */
  export interface IBidderSetting {
    /**
     * Define which key/value pairs are sent to the ad server.
     */
    readonly adserverTargeting: IAdServerTargeting[];

    /**
     * Some bidders return gross prices instead of the net prices (what the publisher will actually get paid).
     * For example, a publisher’s net price might be 15% below the returned gross price. In this case, the publisher may
     * want to adjust the bidder’s returned price to run a true header bidding auction.
     * Otherwise, this bidder’s gross price will unfairly win over your other demand sources who report the real price.
     */
    readonly bidCpmAdjustment?: (bidCpm: number, bid: IBidResponse) => number;
  }

  /**
   * For each bidder’s bid, Prebid.js will set 4 keys (hb_bidder, hb_adid, hb_pb, hb_size) with their corresponding
   * values. The key value pair targeting is applied to the bid’s corresponding ad unit. Your ad ops team will have the
   * ad server’s line items target these keys.
   *
   *  If you’d like to customize the key value pairs, you can overwrite the settings as the below example shows.
   *  Note that once you updated the settings, let your ad ops team know about the change, so they can update the line
   *  item targeting accordingly. See the Ad Ops documentation for more information.
   *
   *  There’s no need to include this code if you choose to use the below default setting.
   */
  export interface IAdServerTargeting {
    readonly key: string;

    val(bidResponse: IBidResponse): string;
  }
}

/* tslint:disable:interface-name */
declare global {

  /**
   * Add pbjs to the global Window instance
   */
  interface Window {

    /**
     * global prebid.js object
     */
    pbjs: prebidjs.IPrebidJs;
  }
}
/* tslint:enable:interface-name */
