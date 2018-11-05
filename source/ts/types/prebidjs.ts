/**
 * Api Reference for Prebid.js
 *
 * @see {@link http://prebid.org/dev-docs/publisher-api-reference.html}
 */
export namespace prebidjs {

  export interface IPrebidJs {

    /**
     * Command queue on the `pbjs` window object.
     * All functions will be executed once pbjs is loaded.
     */
    que: Array<Function>;

    /**
     * Prebid version
     */
    version: string;

    adserverRequestSent: boolean;

    /**
     * The bidderSettings object provides a way to define some behaviors for the platform and specific adapters.
     * The basic structure is a ‘standard’ section with defaults for all adapters, and then one or more
     * adapter-specific sections that override behavior for that bidder.
     */
    bidderSettings: IBidderSettings;

    /**
     * Define ad units and their corresponding header bidding bidders' tag IDs.
     */
    addAdUnits(adUnits: IAdUnit[]): void;

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
     * @see http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
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

  }

  /**
   * == Global Prebid Configuration ==
   *
   * Contains various configuration options for prebid. The type is not complete. Only the necessary configuration
   * options are listed here.
   *
   * NOTE: modules can extend this configuration as well, so you may find the information in various prebid
   *       documentation pages. One example is the consentModule.
   *
   * @see http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
   */
  export interface IPrebidJsConfig {

    /**
     * Turn on debugging
     */
    debug?: boolean;

    /**
     * global bidder timeout
     */
    bidderTimeout?: number;

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
     * Default: tre
     */
    enableSendAllBids?: boolean;

    /**
     * 'Consent Management' module configuration
     *
     * @see http://prebid.org/dev-docs/modules/consentManagement.html
     */
    consentManagement?: {
      /**
       * The ID for the CMP in use on the page. Default is 'iab'
       */
      cmpApi?: 'iab';

      /**
       * Length of time (in milliseconds) to allow the CMP to perform its tasks before aborting the process. Default is 10000
       */
      timeout: number;

      /**
       * A setting to determine what will happen when obtaining consent information from the CMP fails;
       * either allow the auction to proceed (true) or cancel the auction (false). Default is true
       */
      allowAuctionWithoutConsent?: boolean;
    };

    /**
     * == Configure User Syncing ==
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
     * @see http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
     */
    userSync?: {

      /**
       * Enable/disable the user syncing feature. Default: true.
       */
      syncEnabled?: boolean;

      /**
       * Delay in milliseconds for syncing after the auction ends. Default: 3000.
       */
      syncDelay?: number;


      /**
       * Number of registered syncs allowed per adapter. Default: 5. To allow all, set to 0.
       */
      syncsPerBidder?: number;


      /**
       * Configure lists of adapters to include or exclude their user syncing based on the pixel type (image/iframe).
       */
      filterSettings?: {

        /**
         * From the documentation:
         * If you want to apply the same bidder inclusion/exlusion rules for both types of sync pixels,
         * you can use the all object instead specifying both image and iframe objects like so
         */
        all?: {
          /**
           * Array of bidders that should be filtered. '*' means all.
           */
          bidders: Array<BidderCode | '*'>;

          filter: 'include' | 'exclude';
        }

        /**
         * Allow iframe-based syncs (the presence of a valid filterSettings.iframe object automatically enables iframe type user-syncing).
         *
         * Note - iframe-based syncing is disabled by default.
         */
        iframe?: {
          /**
           * Array of bidders that should be filtered. '*' means all.
           */
          bidders: Array<BidderCode | '*'>;

          filter: 'include' | 'exclude';
        }

        /**
         * Image-based syncing is enabled by default; it can be disabled by excluding all/certain bidders via the filterSettings object.
         */
        image?: {
          /**
           * Array of bidders that should be filtered. '*' means all.
           */
          bidders: Array<BidderCode | '*'>;

          filter: 'include' | 'exclude';
        }
      }

      /**
       * Enable/disable publisher to trigger user syncs by calling pbjs.triggerUserSyncs(). Default: false.
       */
      enableOverride?: boolean;
    };

    /**
     * The configuration for the currency module
     *
     * http://prebid.org/dev-docs/modules/currency.html
     */
    currency: {

      /**
       * ISO 4217 3-letter currency code.
       * If this value is present, the currency conversion feature is activated.
       */
      adServerCurrency: 'EUR';

      /**
       * How much to scale the price granularity calculations. Defaults to 1.
       * Note: The multiplier may not make sense for markets
       * where the currency value is close to USD, e.g. GBP and EUR.
       * In those scenarios, just leave the granularityMultiplier at 1.
       */
      granularityMultiplier: 1;

      /**
       * An optional parameter that defines a default rate that can be used
       * if the currency file cannot be loaded.
       * This option isn’t used when the rates parameter is supplied.
       *
       * Prebid hosts a conversion file here: https://currency.prebid.org/latest.json
       */
      defaultRates: { 'USD': { 'EUR': number } };
    };
  }

  /**
   * For AdUnits with MediaType: banner
   */
  export interface IMediaTypeBanner {
    /**
     * All the sizes that this ad unit can accept.
     * Hint: Some SSPs handles only the first size, so keep that in mind.
     */
    readonly sizes: [number, number][];
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
     * Player size that this ad unit can accept (width, height).
     */
    readonly playerSize: [number, number];
  }

  /**
   * Defines one or multiple media types the ad unit supports.
   * Media Types can be "banner", "native" or "video
   */
  export interface IMediaTypes {

    readonly banner?: IMediaTypeBanner;

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
   * @see http://prebid.org/dev-docs/show-outstream-video-ads.html
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

  /**
   * The bidder code is used to identify the different SSPs.
   */
  export type BidderCode = typeof Criteo | typeof AppNexusAst | typeof ImproveDigital | typeof IndexExchange | typeof JustPremium |
    typeof NanoInteractive | typeof PubMatic | typeof OpenX | typeof SmartAdServer | typeof Unruly | typeof Teads;

  /**
   * A bid object.
   */
  export interface IBidObject<B extends BidderCode, T> {
    /**
     * The bidder code.
     */
    readonly bidder: B;

    /**
     * The bidder's preferred way of identifying a bid request.
     */
    readonly params: T;
  }

  /**
   * Criteo bid parameters. There is no public available documentation. All information was
   * gathered from the prebid.js criteo adapter implementation.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/criteoBidAdapter.js
   */
  export interface ICriteoParams {
    readonly zoneId: number;
  }
  export interface ICriteoBid extends IBidObject<typeof Criteo, ICriteoParams> { }


  export interface IAppNexusASTKeyword {
    [key: string]: string[];
  }

  /**
   * AppNexusAST bid parameters.
   *
   * The type definition may not be complete as only the actually used (or tested)
   * fields are being modelled in this definition.
   *
   * @see http://prebid.org/dev-docs/bidders.html#appnexusAst
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
     * @see http://prebid.org/dev-docs/bidders.html#appnexus-video-object
     */
    readonly video?: {

      /**
       * Array of strings listing the content MIME types supported
       */
      readonly mimes?: string[];

      /**
       * 	Integer that defines the minimum video ad duration in seconds.
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
       * playback_method	Array of strings listing playback methods supported by the publisher.
       */
      readonly playback_method?: Array<'auto_play_sound_on' | 'auto_play_sound_off' | 'click_to_play' | 'mouseover' | 'auto_play_sound_unknown'>

      /**
       * 	Array of integers listing API frameworks supported by the publisher.
       * 	Allowed values:
       * 	  0: None
       * 	  1: VPAID 1.0
       * 	  2: VPAID 2.0
       * 	  3: MRAID 1.0:
       * 	  4: ORMMA
       * 	  5: MRAID 2.0
       */
      readonly frameworks: Array<0 | 1 | 2 | 3 | 4 | 5>;
    };

  }

  /**
   * AppNexus bid object.
   */
  export interface IAppNexusASTBid extends IBidObject<typeof AppNexusAst, IAppNexusASTParams> { }

  /**
   * ImproveDigital bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/improvedigitalBidAdapter.js
   */
  export interface IImproveDigitalParams {
    readonly placementId: number;
    /**
     * Optional field to add additional targeting values.
     * Arbitrary keys can be added. The value is always a string array.
     */
    keyValues?: {

      /** IAB values */
      category: string[]
    };
  }

  /**
   * ImproveDigital bid object.
   */
  export interface IImproveDigitalBid extends IBidObject<typeof ImproveDigital, IImproveDigitalParams> {
    placementCode: string;
  }

  /**
   * IndexExchange bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/indexExchangeBidAdapter.js
   * @see Documentation http://prebid.org/dev-docs/bidders/indexExchange.html
   */
  export interface IIndexExchangeParams {
    readonly siteId: string;
    readonly size: number[];
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
  export const JustPremiumSideAd = 'sa';
  export const JustPremiumWallpaper = 'wp';
  export const JustPremiumMobileScroller = 'is';

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
    typeof JustPremiumSideAd |
    typeof JustPremiumWallpaper |
    typeof JustPremiumMobileScroller;

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

  export interface IJustPremiumBid extends IBidObject<typeof JustPremium, IJustPremiumParams> { }

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
  }

  export interface IPubMaticBid extends IBidObject<typeof PubMatic, IPubMaticParams> { }


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
  export interface INanoInteractiveBid extends IBidObject<typeof NanoInteractive, INanoInteractiveParams> { }

  /**
   * OpenX bid parameters
   *
   * @see http://prebid.org/dev-docs/bidders/openx.html
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
  }

  /**
   * OpenX bid object
   */
  export interface IOpenxBid extends IBidObject<typeof OpenX, IOpenxParams> { }

  /**
   * Smart bid parameters
   *
   * @see http://prebid.org/dev-docs/bidders/smartadserver.html
   *
   */
  export interface ISmartAdServerParams {
    /**
     * The network domain
     * example: "https://prg.smartadserver.com"
     */
    domain: string;

    /**
     * The placement site ID
     * example: 1234
     */
    siteId: number;

    /**
     * The placement page ID
     * examples: 1234
     */
    pageId: number;

    /**
     * 	The placement format ID
     * 	example: 1234
     */
    formatId: number;

    /**
     *
     */
    currency?: 'EUR' | 'USD';
  }

  /**
   * Smart bid object
   */
  export interface ISmartAdServerBid extends IBidObject<typeof SmartAdServer, ISmartAdServerParams> { }

  /**
   * Unruly bid parameters
   *
   * @see http://prebid.org/dev-docs/bidders#unruly
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
  export interface IUnrulyBid extends IBidObject<typeof Unruly, IUnrulyParams> { }

  /**
   * Teads bid parameters
   *
   * @see http://prebid.org/dev-docs/bidders#teads
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
  export interface ITeadsBid extends IBidObject<typeof Teads, ITeadsParams> { }


  /**
   * Supported bid object types.
   */
  export type IBid = ICriteoBid | IAppNexusASTBid | IImproveDigitalBid | IIndexExchangeBid | IJustPremiumBid | INanoInteractiveBid | IPubMaticBid | IOpenxBid | ISmartAdServerBid | IUnrulyBid | ITeadsBid;

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
     * Callback to execute when all the bid responses are back or the timeout hits.
     * @param bidResponses contains all valid SSP responses
     * @param timedOut - true if the handler was called due to hitting the timeout. false others
     */
    readonly bidsBackHandler?: (bidResponses: IBidResponsesMap, timedOut: boolean) => void;
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
   * == Concrete BidResponse types ==
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

  export type BidResponse = IBidResponse | IJustPremiumBidResponse;

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
   * @see http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
   */
  export interface IBidderSettings {

    /** used as a fallback if the SSP has no custom bidder settings */
    readonly standard: IBidderSetting;

    /** criteo bidder settings */
    readonly criteo: IBidderSetting;

    /** appNexus bidder settings */
    readonly appnexusAst: IBidderSetting;

    /** improveDigital bidder settings */
    readonly improvedigital: IBidderSetting;

    /** indexExchange bidder settings */
    readonly ix: IBidderSetting;

    /** nano interactive bidder settings */
    readonly nanoInteractive: IBidderSetting;

    /** just premium bidder settings */
    readonly justpremium: IBidderSetting;

    /** PubMatic bidder settings */
    readonly pubmatic: IBidderSetting;

    /** OpenX bidder settings */
    readonly openx: IBidderSetting;

    /** Smart AdServer bidder settings */
    readonly smartadserver: IBidderSetting;

    /** unruly bidder settings */
    readonly unruly: IBidderSetting;

    /** teads bidder settings */
    readonly teads: IBidderSetting;
  }

  /**
   * @see http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
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
