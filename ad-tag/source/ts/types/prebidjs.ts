/**
 * Api Reference for Prebid.js
 *
 * @see https://prebid.org/dev-docs/publisher-api-reference.html
 */
import { SupplyChainObject } from './supplyChainObject';

export namespace prebidjs {
  export interface IPrebidjsWindow {
    /**
     * global prebid.js object
     */
    pbjs: prebidjs.IPrebidJs;
  }

  export interface IPrebidJs {
    /**
     * Command queue on the `pbjs` window object.
     * All functions will be executed once pbjs is loaded.
     */
    que: {
      push(callback: Function): void;
    };

    /**
     * indicates that the Prebid library has been loaded
     */
    readonly libLoaded: boolean;

    /**
     * Prebid version
     */
    readonly version: string;

    /**
     * The bidderSettings object provides a way to define some behaviors for the platform and specific adapters.
     * The basic structure is a 'standard' section with defaults for all adapters, and then one or more
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
     * @param adUnitCode(s) - the adUnitCode(s) to remove, if empty it removes all
     */
    removeAdUnit(adUnitCode?: string | string[]): void;

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
     * Outputs the current prebid config.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/getConfig.html
     * @return {prebidjs.IPrebidJsConfig}
     */
    getConfig(): IPrebidJsConfig;

    /**
     * Outputs a clone of the current prebid config.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/readConfig.html
     * @return {prebidjs.IPrebidJsConfig}
     */
    readConfig(): IPrebidJsConfig;

    /**
     *
     * supports a number of advanced configuration options
     *
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.setConfig
     * @param {prebidjs.IPrebidJsConfig} config
     */
    setConfig(config: Partial<IPrebidJsConfig>): void;

    /**
     * This function is similar to setConfig, but is designed to support certain bidder-specific scenarios.
     *
     * Configuration provided through the setConfig function is globally available to all bidder adapters.
     * This makes sense because most of these settings are global in nature. However, there are use cases where
     * different bidders require different data, or where certain parameters apply only to a given bidder.
     * Use `setBidderConfig` when you need to support these cases.
     *
     * Note if you would like to add to existing config you can pass `true` for the optional second mergeFlag argument
     * like `setBidderConfig(options, true)`. If not passed, this argument defaults to false and setBidderConfig replaces
     * all values for specified bidders.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setBidderConfig.html
     */
    setBidderConfig(
      configAndBidders: {
        readonly bidders: BidderCode[];
        readonly config: Partial<IPrebidJsConfig>;
      },
      mergeFlag?: boolean
    ): void;

    /**
     * Request bids. When adUnits or adUnitCodes are not specified, request bids for all ad units added.
     */
    requestBids(requestParam?: IRequestObj): Promise<IRequestBidsResult>;

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
     * If you need to export the user IDs stored by Prebid User ID module, the `getUserIds()` function will return an
     * object formatted the same as bidRequest.userId.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userId.html#exporting-user-ids
     */
    getUserIds(): userSync.UserIds;

    /**
     * Enable sending analytics data to the analytics provider of your choice.
     *
     * For usage, see Integrate with the [Prebid Analytics API](http://prebid.org/dev-docs/integrate-with-the-prebid-analytics-api.html)
     *
     * @param adapters
     * @see http://prebid.org/overview/analytics.html
     * @see http://prebid.org/dev-docs/integrate-with-the-prebid-analytics-api.html
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/enableAnalytics.html
     */
    enableAnalytics(adapters: analytics.AnalyticsAdapter[]): void;

    /**
     * NOTE: this is a very rough typing. As prebid doesn't help you a lot with what is defined and what not,
     *       you have to try your own luck :(
     *
     *
     * @param event name of the event
     * @param handler callback handling the events
     * @param id The optional id parameter provides more finely-grained event callback registration.
     *        This makes it possible to register callback events for a specific item in the event context
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.onEvent
     */
    onEvent<E extends keyof event.PrebidEventMap>(
      event: E,
      handler: (data: event.PrebidEvent<E>) => void,
      id?: string
    ): void;

    /**
     * Deregister
     *
     * @param event name of the event
     * @param handler callback handling the events
     * @param id The optional id parameter provides more finely-grained event callback registration.
     *        This makes it possible to register callback events for a specific item in the event context
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.onEvent
     */
    offEvent<E extends keyof event.PrebidEventMap>(
      event: E,
      handler: (data: event.PrebidEvent<E>) => void,
      id?: string
    ): void;

    /**
     * Convert a cpm from a currency to another one.
     * This method is only available if the currency module (https://docs.prebid.org/dev-docs/modules/currency.html) is activated.
     *
     * @param cpm The cpm to convert.
     * @param fromCurrency The currency in which the current cpm is.
     * @param toCurrency The currency you want to convert the cpm to.
     *
     * @see https://github.com/prebid/Prebid.js/blob/804295aa2dae0484d67891b73fcfc401ef8244f1/modules/currency.js#L127
     */
    convertCurrency?(cpm: number, fromCurrency: string, toCurrency: string): number;

    /**
     * This function is available when the  _First Party Data Enrichment Module_ is integrated.
     *
     * If the publisher needs to refresh the enriched FPD after the first auction, this can be done using a function
     * provided by this module
     *
     * @see https://docs.prebid.org/dev-docs/modules/enrichmentFpdModule.html
     */
    refreshFpd?();

    /**
     * Use this method to retrieve an array of winning bids.
     *
     * with no argument, returns an array of winning bid objects for each ad unit on page.
     * when passed an ad unit code, returns an array with the winning bid object for that ad unit
     *
     * @param adUnitCode - optional filter for the given ad unit code
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/getHighestCpmBids.html
     */
    getHighestCpmBids(adUnitCode?: string): prebidjs.BidResponse[];

    /**
     * This function will render the ad (based on params) in the given iframe document passed through.
     *
     * Note that doc SHOULD NOT be the parent document page as we can’t doc.write() asynchronously.
     * This function is usually used in the ad server’s creative.
     *
     * @param iframeDocument
     * @param adId - bid id to locate the ad
     */
    renderAd(iframeDocument: Document, adId: string): void;

    /**
     * Registers the encrypted signal providers with googletag.
     *
     * @see https://github.com/prebid/Prebid.js/issues/8532
     * @see https://github.com/prebid/prebid.github.io/issues/3830
     */
    registerSignalSources?: () => void;

    getAllWinningBids(): prebidjs.BidResponse[];

    /**
     * Defining an alias can help avoid user confusion since it’s possible to send parameters to the same adapter
     * but in different contexts (e.g, The publisher uses "appnexus" for demand and also uses "newAlias" which is an
     * SSP partner that uses the "appnexus" adapter to serve their own unique demand).
     *
     * @example ```javascript
     * pbjs.aliasBidder('bidderA', 'aliasOfBidderA', {gvlid: 9999});
     * ```
     *
     * @param bidderCode
     * @param alias
     * @param options - `gvlid` IAB Global Vendor List ID for this alias for use with the TCF control module.
     *                - `useBaseGvlid` Flag determining if the GVL ID of the original adapter should be re-used. (PBJS 9.14+)
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/aliasBidder.html
     */
    aliasBidder(
      bidderCode: string,
      alias: string,
      options?: { gvlid?: number; useBaseGvlid?: boolean }
    ): void;
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
       * By default, the adapter doesn't send Prebid ad unit sizes to Improve Digital's ad server
       * and the sizes defined for each placement in the Polaris platform will be used.
       *
       * This configuration makes improve use the prebid sizes parameter.
       *
       * Available since prebid 2.8.0
       */
      readonly usePrebidSizes: boolean;
    };
  }

  interface IIndexExchangeConfig {}

  /**
   * ## Global Rubicon configuration
   *
   * This extends the [[IPrebidJsConfig]] with Rubicon specific configuration options.
   *
   */
  interface IRubiconConfig {
    /**
     * Global Rubicon property
     */
    readonly rubicon?: {
      /**
       * Enable the single request mode, which will send all bids in one request.
       *
       * Available since prebid 1.12.0
       */
      readonly singleRequest: boolean;
    };
  }

  interface IAdagioConfig {
    /**
     * Global Adagio property
     */
    readonly adagio?: {
      /**
       * a global `siteId` is a shortcut to facilitate the integration for publisher.
       */
      readonly siteId?: string;

      /**
       *  Edge case. Useful when Prebid Manager cannot handle properly params setting
       */
      readonly useAdUnitCodeAsPlacement?: boolean;
    };
  }

  /**
   *
   * The `targetingControls` object passed to `pbjs.setConfig` provides some options to influence how an auction’s
   * targeting keys are generated and managed.
   *
   * @see [Configure Targeting Controls](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#configure-targeting-controls)
   */
  export namespace targetingcontrols {
    /**
     * List of available targeting keys from prebid
     *
     * @see [setConfig allowTargetingKeys setting](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#details-on-the-allowtargetingkeys-setting)
     */
    export type TargetingKeys =
      | 'BIDDER'
      | 'AD_ID'
      | 'PRICE_BUCKET'
      | 'SIZE'
      | 'DEAL'
      | 'SOURCE'
      | 'FORMAT'
      | 'UUID'
      | 'CACHE_ID'
      | 'CACHE_HOST'
      | 'ADOMAIN'
      | 'title'
      | 'body'
      | 'body2'
      | 'privacyLink'
      | 'privacyIcon'
      | 'sponsoredBy'
      | 'image'
      | 'icon'
      | 'clickUrl'
      | 'displayUrl'
      | 'cta'
      | 'rating'
      | 'address'
      | 'downloads'
      | 'likes'
      | 'phone'
      | 'price'
      | 'salePrice';

    /**
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#configure-targeting-controls
     */
    export interface ITargetingControls {
      /**
       * Specifies the maximum number of characters the system can add to ad server targeting.
       */
      readonly auctionKeyMaxChars?: number;

      /**
       * To make sure that deal bids are sent along with the winning bid in the `enableSendAllBids:false` scenario,
       * use the alwaysIncludeDeals flag that's part of targetingControls
       */
      readonly alwaysIncludeDeals?: boolean;

      /**
       * Selects supported default targeting keys.
       */
      readonly allowTargetingKeys?: TargetingKeys[];

      /**
       * Selects targeting keys to be supported in addition to the default ones
       */
      readonly addTargetingKeys?: TargetingKeys[];

      /**
       * Selects supported default targeting keys.
       */
      readonly allowSendAllBidsTargetingKeys?: TargetingKeys[];
    }
  }

  /**
   * 'Consent Management' module configuration
   *
   * @see https://prebid.org/dev-docs/modules/consentManagement.html
   */
  export namespace consent {
    export interface IConsentManagementConfig {
      /**
       * @see http://prebid.org/dev-docs/modules/gdprEnforcement.html
       */
      readonly gdpr?: IGdprConfig;

      /**
       * @see https://docs.prebid.org/dev-docs/modules/consentManagementUsp.html
       */
      readonly usp?: IUspConfig;
    }

    /**
     * A page needs to define configuration rules about how Prebid.js should enforce each in-scope activity
     *
     * @see https://docs.prebid.org/dev-docs/modules/consentManagement.html
     * @see http://prebid.org/dev-docs/modules/gdprEnforcement.html
     */
    export interface IGdprConfig {
      /**
       * The ID for the CMP in use on the page. Default is 'iab'
       */
      readonly cmpApi?: 'iab';

      /**
       * Length of time (in milliseconds) to allow the CMP to perform its tasks before aborting the process.
       *
       * @default `10000` ms
       */
      readonly timeout?: number;

      /**
       * A setting to determine what will happen when obtaining consent information from the CMP fails;
       * either allow the auction to proceed (true) or cancel the auction (false). Default is true
       */
      readonly allowAuctionWithoutConsent?: boolean;

      /**
       * Defines what the gdprApplies flag should be when the CMP doesn’t respond in time or the static
       * data doesn’t supply. D
       *
       * @default `false`
       */
      readonly defaultGdprScope?: boolean;

      /**
       * Lets the publisher override the default behavior.
       * @see https://docs.prebid.org/dev-docs/modules/gdprEnforcement.html
       */
      readonly rules?: IGdprConfigRule[];
    }

    export interface IGdprConfigRule {
      /**
       * Supported values:
       * - "storage" (Purpose 1)
       * - "basicAds" (Purpose 2)
       * - "measurement" (Purpose 7)
       */
      readonly purpose: 'storage' | 'basicAds' | 'measurement';

      /**
       * Determines whether to enforce the purpose consent or not. The default in Prebid.js 3.x is not to enforce
       * purposes. The plan for Prebid.js 4.0 is to enforce consent for Purpose 1 and no others.
       */
      readonly enforcePurpose: boolean;

      /**
       * Determines whether to enforce vendor signals for this purpose or not. The default in Prebid.js 3.x is not to
       * enforce vendor signals. The plan for Prebid.js 4.0 to enforce signals for Purpose 1 and no others.
       */
      readonly enforceVendor: boolean;

      /**
       * Defines a list of biddercodes or module names that are exempt from the enforcement of this Purpose.
       *
       * The vendorExceptions list is based on Prebid.js biddercodes instead of Global Vendor List (GVL) IDs,
       * i.e. "rubicon" instead of "52". This was done to accomodate Prebid.js modules and adapters that don't have
       * GVL IDs.
       *
       * @example
       * ```js
       * ["bidderA", "userID-module-B"]
       * ```
       */
      readonly vendorExceptions?: string[];
    }
  }

  /**
   * This consent management module is designed to support the California Consumer Privacy Act (CCPA). The IAB has
   * generalized these guidelines to cover future regulations, referring to the feature as "US Privacy".
   *
   * @see https://docs.prebid.org/dev-docs/modules/consentManagementUsp.html
   */
  export interface IUspConfig {
    /**
     * The USP-API interface that is in use. Supported values are `iab` or `static`.
     * Static allows integrations where IAB-formatted strings are provided in a non-standard way.
     *
     * @default `iab`
     */
    readonly cmpApi: 'iab';

    /**
     * Length of time (in milliseconds) to allow the USP-API to obtain the CCPA string.
     *
     * @default 50
     */
    readonly timeout?: number;
  }

  /**
   * This configuration defines the price bucket granularity setting that will be used for the hb_pb keyword.
   *
   * @see http://prebid.org/dev-docs/publisher-api-reference.html#price-granularity
   */
  export namespace priceGranularity {
    export type PriceGranularityConfig =
      | 'low'
      | 'medium'
      | 'high'
      | 'auto'
      | 'dense'
      | ICustomPriceGranularityConfig;

    /**
     * This configuration defines the price bucket granularity setting that will be used for the hb_pb keyword.
     */
    export interface ICustomPriceGranularityConfig {
      readonly buckets: IPriceBucketConfig[];
    }

    /**
     * The default Prebid price granularities cap out at $20, which isn't always convenient for video ads, which
     * can command more than $20. One solution is to just set up a custom price granularity as described above.
     * Another approach is mediaTypePriceGranularity config that may be set to define granularities for each of
     * five media types: banner, video, video-instream, video-outstream, and native.
     */
    export interface IMediaTypePriceGranularityConfig {
      readonly video: PriceGranularityConfig;
      readonly 'video-outstream': PriceGranularityConfig;
      readonly banner: PriceGranularityConfig;
      readonly native: PriceGranularityConfig;
    }

    /**
     * @example
     * ```javascript
     * const customConfigObject = {
     * "buckets" : [{
     *     "precision": 2,  //default is 2 if omitted - means 2.1234 rounded to 2 decimal places = 2.12
     *     "max" : 5,
     *     "increment" : 0.01  // from $0 to $5, 1-cent increments
     *  },
     *  {
     *    "max" : 8,
     *    "increment" : 0.05  // from $5 to $8, round down to the previous 5-cent increment
     *  },
     *  {
     *    "max" : 40,
     *    "increment" : 0.5   // from $8 to $40, round down to the previous 50-cent increment
     *  }]
     * };
     * ```
     */
    export interface IPriceBucketConfig {
      /**
       * default is 2 if omitted - means 2.1234 rounded to 2 decimal places = 2.12
       */
      readonly precision?: number;

      /**
       * Upper limit for this price bucket
       */
      readonly max: number;

      /**
       * Increment steps in publisher currency
       */
      readonly increment: number;
    }
  }

  /**
   * ## Auction options
   *
   * The `auctionOptions` object controls aspects related to auctions.
   *
   * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#auction-options
   */
  export namespace auctionOptions {
    /**
     * ## Auction options
     *
     * The `auctionOptions` object controls aspects related to auctions.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#auction-options
     */
    export interface IAuctionOptionsConfig {
      /**
       * Specifies bidders that the Prebid auction will no longer wait for before determining the auction has completed.
       * This may be helpful if you find there are a number of low performing and/or high timeout bidders in your page’s rotation.
       */
      readonly secondaryBidders?: BidderCode[];

      /**
       * When true, prevents banner bids from being rendered more than once.
       * It should only be enabled after auto-refreshing is implemented correctly.
       *
       * @default `false`
       */
      readonly suppressStaleRender?: boolean;
    }
  }

  /**
   * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-realTimeData
   */
  export namespace realtimedata {
    /**
     *
     * All of the modules that fall under the [Real-Time Data (RTD) category](https://docs.prebid.org/dev-docs/modules/index.html#real-time-data-providers)
     * conform to a consistent set of publisher controls. The pub can choose to run multiple RTD modules, define an
     * overall amount of time they’re willing to wait for results, and even flag some of the modules as being more
     * "important" than others.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-realTimeData
     * @see https://docs.prebid.org/dev-docs/modules/index.html#real-time-data-providers
     */
    export interface IDataProvider {
      /**
       * Setting this value to true flags this RTD module as “important” enough to wait the full auction delay period.
       * Once all such RTD modules have returned, the auction will proceed even if there are other RTD modules that have not yet responded.
       *
       * @default `false`
       */
      readonly waitForIt: boolean;
    }

    /**
     * The Geolocation module lets publishers get user’s precise location with their permissions. The first permission
     * that is needed is directly asked from site’s navigator alert. Then if site has installed a
     * CMP (Consent Management Platform), this module checks the geolocation permission from consent data.
     *
     * The module provides Geolocation coords using the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).
     *
     *
     * @see https://docs.prebid.org/dev-docs/modules/geolocationRtdProvider.html
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
     */
    export interface IGeolocationDataProviderModule extends IDataProvider {
      readonly name: 'geolocation';
      readonly params: {
        /**
         * If the module should ask for permission to access geo data
         */
        readonly requestPermission: boolean;
      };
    }

    /**
     * The timeout RTD module enables publishers to set rules that determine the timeout based on certain features.
     * It supports rules dynamically retrieved from a timeout provider as well as rules set directly via configuration.
     *
     * @see https://docs.prebid.org/dev-docs/modules/timeoutRtdProvider.html
     */
    export interface ITimeoutDataProviderModule extends IDataProvider {
      readonly name: 'timeout';
      readonly params: {
        readonly endpoint: {
          readonly url: string;
        };
      };
    }

    /**
     * The Intersection module provides intersection for ad slots on the page using Intersection Observer API.
     *
     * @see https://docs.prebid.org/dev-docs/modules/intersectionRtdProvider.html
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
     */
    export interface IIntersectionDataProviderModule extends IDataProvider {
      readonly name: 'intersection';
    }

    /**
     * Confiant’s module provides comprehensive detection of security, quality, and privacy threats across your ad stack.
     * Confiant is the industry leader in real-time detecting and blocking of bad ads when it comes to protecting
     * your users and brand reputation.
     *
     * @see https://docs.prebid.org/dev-docs/modules/confiantRtdProvider.html
     */
    export interface IConfiantDataProviderModule extends IDataProvider {
      readonly name: 'confiant';
      readonly params: {
        readonly propertyId: string;

        /**
         * comma separated list of bidders to exclude from Confiant's prebid.js integration
         */
        readonly prebidExcludeBidders?: string;

        /**
         * namespace for prebid.js integration
         */
        readonly prebidNameSpace?: string;

        /**
         * upon being set to true enables firing of the BillableEvent upon Confiant's impression scanning
         */
        readonly shouldEmitBillableEvent?: boolean;
      };
    }

    /**
     * This module can be used in combination with Adagio Bid Adapter (SSP) and/or with Adagio prebid server endpoint.
     * It computes and collects data required to leverage Adagio viewability and attention prediction engine.
     *
     * > Disclosure: This module loads external code that is not open source and has not been reviewed by Prebid.org.
     *
     * NOTE: This is available since prebid 9.6.0 and is recommended
     *
     * @see https://docs.prebid.org/dev-docs/modules/adagioRtdProvider.html
     */
    export interface IAdagioDataProviderModule extends IDataProvider {
      readonly name: 'adagio';
      readonly params: {
        /**
         * Account id provided by Adagio.
         */
        readonly organizationId: string;

        /**
         * Account site name provided by Adagio.
         */
        readonly site: string;

        /**
         * Programmatically set the `ortb2Imp.ext.data.placement` signal based on location.
         * Possible values: ortb (default), code, gpid.
         */
        readonly placementSource?: 'ortb' | 'code' | 'gpid';
      };
    }

    type DataProvider =
      | IAdagioDataProviderModule
      | IGeolocationDataProviderModule
      | ITimeoutDataProviderModule
      | IIntersectionDataProviderModule
      | IConfiantDataProviderModule;

    export interface IRealTimeDataConfig {
      /**
       * Defines the maximum amount of time, in milliseconds, the header bidding auction will be delayed while waiting
       * for a response from the RTD modules as a whole group. The default is 0 ms delay, which means that RTD modules
       * need to obtain their data when the page initializes.
       */
      readonly auctionDelay: number;

      readonly dataProviders: DataProvider[];
    }
  }

  export namespace userSync {
    /**
     * ## Configure User Syncing
     *
     * The user sync configuration options described in this section give publishers control over how adapters behave
     * with respect to dropping pixels or scripts to cookie users with IDs. This practice is called “user syncing”
     * because the aim is to let the bidders match IDs between their cookie space and the DSP's cookie space. There's a
     * good reason for bidders to be doing this – DSPs are more likely to bid on impressions where they know something
     * about the history of the user. However, there are also good reasons why publishers may want to control the use of
     * these practices:
     *
     * - Page performance: Publishers may wish to move ad-related cookie work to much later in the page load after ads
     *                     and content have loaded.
     * - User privacy:     Some publishers may want to opt out of these practices even though it limits their users'
     *                     values on the open market.
     * - Security:         Publishers may want to control which bidders are trusted to inject images and JavaScript into
     *                     their pages.
     *
     * User syncing default behavior If you don't tweak any of the settings described in this section, the default
     * behavior of Prebid.js is to wait 3 seconds after the auction ends, and then allow every adapter to drop up to
     * 5 image-based user syncs.
     *
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing
     */
    export interface IUserSyncConfig {
      /**
       * Enable/disable the user syncing feature. Default: true.
       */
      readonly syncEnabled?: boolean;

      /**
       * Delay in milliseconds for syncing after the auction ends. Default: 3000.
       */
      readonly syncDelay?: number;

      /**
       * Delay in milliseconds of the auction to retrieve user ids via the userId module before the auction starts.
       * Continues auction once all IDs are retrieved or delay times out. Does not apply to bid adapter user sync pixels.
       *
       * Default: 0.
       * @see http://prebid.org/dev-docs/modules/userId.html
       */
      readonly auctionDelay?: number;

      /**
       * Number of registered syncs allowed per adapter. Default: 5. To allow all, set to 0.
       *
       * @default 5
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

      /**
       * Enable/disable registered syncs for aliased adapters.
       * @default: `false`
       */
      readonly aliasSyncEnabled?: boolean;

      readonly userIds?: UserIdProvider[];

      /**
       * Google now supports Encrypted Signals for Publishers(ESP), a program that allows publishers can explicitly
       * share encrypted signals on bid requests with third-party bidders. User ID modules now support code which will
       * register the signal sources and encrypted signal are created and is sent to GAM request in a3p parameter.
       * ‘encryptedSignal’ configuration under userSync Module will help to configure signal sources.
       *
       * @see https://docs.prebid.org/dev-docs/modules/userId.html#esp-configurations
       * @see https://support.google.com/admanager/answer/10488752?hl=en
       */
      readonly encryptedSignalSources?: IEncryptedSignalSourcesConfig;

      /**
       * Publishers using Google AdManager may want to sync one of the identifiers as their Google PPID for frequency
       * capping or reporting. The PPID in GAM (which is unrelated to the PPID UserId Submodule) has strict rules;
       * refer to [Google AdManager documentation](https://support.google.com/admanager/answer/2880055?hl=en) for them.
       * Please note, Prebid uses a [GPT command](https://developers.google.com/publisher-tag/reference#googletag.PubAdsService) to sync identifiers
       * for publisher convenience. It doesn’t currently work for instream video requests, as Prebid typically interacts
       * with the player, which in turn may interact with IMA. IMA does have [a similar method](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/reference/js/google.ima.ImaSdkSettings#setPpid) as GPT, but IMA does not
       * gather this ID from GPT.
       *
       * Must be a source from the `pbjs.getUserIdsAsEids()` array.
       * @example `pubcid.org`
       * @see https://docs.prebid.org/dev-docs/modules/userId.html#basic-configuration
       * @see https://support.google.com/admanager/answer/2880055?hl=en
       */
      readonly ppid?: EIDSource;
    }

    /**
     * All supported id providers
     */
    export type UserIdProvider =
      | IUnifiedIdProvider
      | IDigitTrustProvider
      | ICriteoProvider
      | IID5Provider
      | IIdentityLinkProvider
      | IPubCommonIdProvider
      | IZeotapIdPlusIdProvider
      | IUtiqIdProvider
      | IUtiqMtpIdProvider
      | ISharedIdProvider
      | IPairIdProvider;

    /**
     * @see https://docs.prebid.org/dev-docs/modules/userId.html#basic-configuration
     */
    interface IUserIdProvider<N extends string> {
      /**
       * the provider name
       */
      readonly name: N;

      /**
       * The publisher can specify some kind of local storage in which to store the results of the call to get
       * the user ID. This can be either cookie or HTML5 storage. This is not needed when value is specified or
       * the ID system is managing its own storage
       */
      readonly storage?: IUserIdStorage;

      /**
       * An array of bidder codes to which this user ID may be sent.
       */
      readonly bidders?: BidderCode[];

      /**
       * Used only if the page has a separate mechanism for storing a User ID. The value is an object containing the
       * values to be sent to the adapters.
       */
      readonly value?: any;
    }

    /**
     * A UserId provider hat requires additional parameters configuration
     */
    interface IParameterizedUserIdProvider<P, N extends string> extends IUserIdProvider<N> {
      /**
       * provider specific params
       */
      readonly params: P;
    }

    export interface IUserIdStorage {
      /**
       *  The publisher can specify some kind of local storage in which to store the results of the call to get the
       *  user ID. This can be either cookie or HTML5 storage. This is not needed when value is specified or the
       *  ID system is managing its own storage
       */
      readonly type: 'cookie' | 'html5';

      /**
       * The name of the cookie or html5 local storage where the user ID will be stored.
       * @example '_unifiedId'
       */
      readonly name: string;

      /**
       * How long (in **days**) the user ID information will be stored. If this parameter isn't specified, session
       * cookies are used in cookie-mode, and local storage mode will create new IDs on every page.
       *
       * Note: This field is optional, but prebid strongly requires it so we make it mandatory.
       */
      readonly expires: number;

      /**
       * NOT APPLICABLE FOR SharedId
       * The amount of time (in **seconds**) the user ID should be cached in storage before calling the provider again
       * to retrieve a potentially updated value for their user ID. If set, this value should equate to a time period
       * less than the number of days defined in `storage.expires`.
       *
       * By default the ID will not be refreshed until it expires.
       */
      readonly refreshInSeconds?: number;

      /**
       * NOT APPLICABLE FOR SharedId
       * Used only if the page has a separate mechanism for storing a User ID. The value is an object containing the
       * values to be sent to the adapters.
       *
       * @example
       * ```json
       * {"tdid": "1111", "pubcid": {2222}, "id5id": "ID5-12345" }
       * ```
       */
      readonly value?: any;
    }

    export interface IUnifiedIdProviderParams {
      /**
       * This is the partner ID value obtained from registering with The Trade Desk
       * or working with a Prebid.js managed services provider.
       *
       * @example "myTtdPid"
       */
      readonly partner?: string;

      /**
       * If specified for UnifiedId, overrides the default Trade Desk URL.
       *
       * @example "https://unifiedid.org/somepath?args"
       */
      readonly url?: string;

      /**
       *
       *  Used only if the page has a separate mechanism for storing the Unified ID. The value is an object
       *  containing the values to be sent to the adapters. In this scenario, no URL is called and nothing
       *  is added to local storage
       *
       * @example
       * ```json
       * {"tdid": "D6885E90-2A7A-4E0F-87CB-7734ED1B99A3"}
       * ```
       */
      readonly value?: {
        readonly tdid: string;
      };
    }

    /**
     * @see http://prebid.org/dev-docs/modules/userId.html#unified-id
     */
    export interface IUnifiedIdProvider
      extends IParameterizedUserIdProvider<IUnifiedIdProviderParams, 'unifiedId'> {}

    /**
     * @see http://prebid.org/dev-docs/modules/userId.html#criteo-id-for-exchanges
     */
    export interface ICriteoProvider extends IUserIdProvider<'criteo'> {}

    /**
     * @see http://prebid.org/dev-docs/modules/userId.html#digitrust
     */
    export interface IDigitTrustProviderParams {
      readonly init: {
        readonly member: string;
        readonly site: string;
      };
      /** Allows init error handling */
      readonly callback?: (result: any) => void;
    }

    /**
     * @see https://console.id5.io/docs/public/prebid
     */
    export interface IDigitTrustProvider
      extends IParameterizedUserIdProvider<IDigitTrustProviderParams, 'digitrust'> {}

    /**
     * Container of all module params.
     */
    export interface IPairIdParams {
      /**
       * Container of all liveramp cleanroom specified params.
       */
      readonly liveramp?: {
        /**
         * storage key to fetch liveramp provided PAIR Id, the default value is "_lr_pairId"
         * @example "_lr_pairId_custom"
         */
        readonly storageKey?: string;
      };
    }

    /**
     * Developed by and for use with Display and Video 360,
     * PAIR (Publisher Advertiser Identity Reconciliation) is a secure and privacy-forward way for enabling advertisers and publishers
     * to reconcile their first-party data for marketing use cases via advanced data encryption methods without the reliance on third-party cookies.
     * PAIR can help advertisers and publishers maintain control of first-party data while ensuring there is no pooling of data,
     * no leakage of data, no leakage of insights, durability for the future using secure encryption methods, and no user tracking across publishers.
     * @See https://docs.prebid.org/dev-docs/modules/userid-submodules/pair.html
     */
    export interface IPairIdProvider
      extends IParameterizedUserIdProvider<IPairIdParams, 'pairId'> {}

    export interface IID5ProviderParams {
      /**
       * This is the ID5 Partner Number obtained from registering with ID5.
       * @example 173
       */
      readonly partner: number;

      /**
       * The pd field (short for Publisher Data) is an optional, base64 encoded string that contains any deterministic
       * user data the publisher has access to. The data will be used strictly to provide better linking of ID5 IDs
       * across domains for improved user identification. If the user has not provided ID5 with a legal basis to process
       * data, the information sent to ID5 will be ignored and neither used nor saved for future requests.
       */
      readonly pd?: string;
    }

    /**
     * The ID5 Universal ID that is delivered to Prebid will be encrypted by ID5 with a rotating key to avoid
     * unauthorized usage and to enforce privacy requirements. Therefore, we strongly recommend setting
     * `storage.refreshInSeconds` to 8 hours (8*3600 seconds) to ensure all demand partners receive an ID that
     * has been encrypted with the latest key, has up-to-date privacy signals, and allows them to transact against it.
     *
     * @see http://prebid.org/dev-docs/modules/userId.html#id5-universal-id
     */
    export interface IID5Provider
      extends IParameterizedUserIdProvider<IID5ProviderParams, 'id5Id'> {}

    export interface IIdentityLinkProviderParams {
      /**
       * This is the placementId, value needed for obtaining user's IdentityLink envelope.
       */
      readonly pid: string;

      /**
       * Property for choosing if a cookieable RampID envelope (RTIS) should be set and stored until the user
       * authenticates which then will be replaced by an authenticated RampID envelope (ATS) (either true or false).
       */
      readonly notUse3P: boolean;
    }

    /**
     * IdentityLink, provided by LiveRamp is a single person-based identifier which allows marketers, platforms and
     * publishers to perform personalized segmentation, targeting and measurement use cases that require a consistent,
     * cross-channel view of the user in anonymous spaces.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userId.html#identitylink
     */
    export interface IIdentityLinkProvider
      extends IParameterizedUserIdProvider<IIdentityLinkProviderParams, 'identityLink'> {}

    /**
     * @see http://prebid.org/dev-docs/modules/userId.html#pubcommon-id
     */
    export interface IPubCommonIdProvider extends IUserIdProvider<'pubCommonId'> {}

    /**
     * Params are identical for UtiqId and UtiqMtpId
     */
    export interface IUtiqIdProviderParams {
      /**
       * Max amount of time (in seconds) before looking into storage for data
       */
      readonly maxDelayTime?: number;
    }

    export interface IUtiqMtpIdProviderParams {
      /**
       * Max amount of time (in seconds) before looking into storage for data
       */
      readonly maxDelayTime?: number;
    }

    /**
     * Prebid 9+ utiq id provider type. The Prebid 8 module was not typed to avoid confusion and
     * unintended behaviour, because prebid filters out unconfigured modules.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userid-submodules/utiq.html
     * @see https://docs.utiq.com/docs/programmatic-integration
     */
    export interface IUtiqIdProvider
      extends IParameterizedUserIdProvider<IUtiqIdProviderParams, 'utiqId'> {}
    /**
     * MTP stands for MarTechPass.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userid-submodules/utiqMtp.html
     * @see https://docs.utiq.com/docs/programmatic-integration
     */
    export interface IUtiqMtpIdProvider
      extends IParameterizedUserIdProvider<IUtiqMtpIdProviderParams, 'utiqMtpId'> {}

    /**
     * ID+, powered by zeotap, enables the marketing ecosystem to overcome challenges posed by the demise of identifiers
     * and a fast-changing regulatory landscape. ID+ is an open invitation to the entire industry to build the future
     * of identity together.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userId.html#id
     */
    export interface IZeotapIdPlusIdProvider extends IUserIdProvider<'zeotapIdPlus'> {}

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

    /**
     * Google now supports Encrypted Signals for Publishers(ESP), a program that allows publishers can explicitly
     * share encrypted signals on bid requests with third-party bidders. User ID modules now support code which will
     * register the signal sources and encrypted signal are created and is sent to GAM request in a3p parameter.
     * ‘encryptedSignal’ configuration under userSync Module will help to configure signal sources.
     *
     * @see https://docs.prebid.org/dev-docs/modules/userId.html#esp-configurations
     * @see https://support.google.com/admanager/answer/10488752?hl=en
     */
    export interface IEncryptedSignalSourcesConfig {
      /**
       * An array of Object consist of sources list and encryption flag
       */
      readonly sources: IEncryptedSignalSource[];

      /**
       * The amount of time (in seconds) after which registering of signals will happen.
       * Default value 0 is considered if ‘registerDelay’ is not provided.
       */
      readonly registerDelay?: number;
    }

    /**
     * @see https://github.com/prebid/Prebid.js/blob/master/modules/userId/eids.md
     */
    export type EIDSource =
      | '33across.com'
      | 'trustpid.com'
      | 'adserver.org'
      | 'navegg.com'
      | 'justtag.com'
      | 'id5-sync.com'
      | 'flashtalking.com'
      | 'parrable.com'
      | 'liveramp.com'
      | 'liveintent.com'
      | 'merkleinc.com'
      | 'britepool.com'
      | 'hcn.health'
      | 'criteo.com'
      | 'netid.de'
      | 'zeotap.com'
      | 'audigent.com'
      | 'quantcast.com'
      | 'verizonmedia.com'
      | 'mediawallahscript.com'
      | 'tapad.com'
      | 'novatiq.com'
      | 'uidapi.com'
      | 'admixer.net'
      | 'deepintent.com'
      | 'kpuid.com'
      | 'yahoo.com'
      | 'thenewco.it'
      | 'pubcid.org'
      | 'utiq.com'
      | 'utiq-mtp.com';

    export interface IEncryptedSignalSource {
      /**
       * An array of sources for which signals needs to be registered
       * @see https://github.com/prebid/Prebid.js/blob/master/modules/userId/eids.md
       */
      readonly source: EIDSource[];

      /**
       * Should be set to false by default.
       */
      readonly encrypt: boolean;

      /**
       * This function will be defined for custom sources only and called which
       * will return the custom data set from the page
       */
      readonly customFunc?: () => any;
    }

    export interface ISharedIdProvider
      extends IParameterizedUserIdProvider<ISharedIdParams, 'sharedId'> {}

    export interface ISharedIdParams {
      /**
       * For publisher server support only. If true, the publisher’s server will create the (pubcid) cookie.
       * Default is true.
       */
      readonly create?: boolean;
      /**
       * For publisher server support only. Where to call out to for a server cookie – see Prebid Identity for more information.
       */
      readonly pixelUrl?: string;
      /**
       * If true, the expiration time of the stored IDs will be refreshed during each page load. Default is false.
       */
      readonly extend?: boolean;
    }

    /**
     * The keys and the value type can be found in the`decode()` method of each user id module.
     * The list is thus not complete.
     */
    export type UserIds = {
      readonly criteoId?: string;

      readonly pubcid?: string;

      readonly amxId?: string;

      readonly idl_env?: string;

      readonly IDP?: string;

      readonly id5id?: {
        readonly uid: string;
      };

      readonly pairId?: {
        readonly name: string;
        readonly params?: {
          readonly liveramp?: {
            readonly storageKey?: string;
          };
        };
      };
    };
  }

  export namespace event {
    export interface PrebidEventMap {
      addAdUnits: void;
      adRenderFailed: RenderFailure;
      adRenderSucceeded: BidResponse;
      auctionDebug: AuctionDebugInfo;
      auctionEnd: AuctionObject;
      auctionInit: AuctionObject;
      auctionTimeout: AuctionObject;
      beforeBidderHttp: BidderRequests;
      beforeRequestBids: BeforeRequestBidsAdUnitInfo;
      bidAccepted: BidResponse;
      bidAdjustment: BidResponse;
      bidderDone: BidderRequests;
      bidRequested: BidderRequests;
      bidResponse: BidResponse;
      bidWon: BidResponse;
      bidTimeout: NoBidObject[];
      noBid: NoBidObject;
      requestBids: void;
      setTargeting: { [key: string]: AdServerTargeting };
      tcf2Enforcement: TCF2Enforcement;
    }

    export type PrebidEvent<E extends keyof PrebidEventMap> = PrebidEventMap[E];

    export type TCF2Enforcement = {
      readonly storageBlocked: string[];
      readonly bidderBlocked: string[];
      readonly analyticsBlocked: string[];
    };

    export type RenderFailure = { readonly reason?: string; readonly message?: string };

    export type AuctionDebugInfo = {
      readonly type: 'WARNING' | 'ERROR';
      readonly arguments?: any[];
    };

    export interface BeforeRequestBidsAdUnitInfo extends IAdUnit {
      readonly sizes?: [number, number][];
      readonly transactionId?: string;
    }

    export type GdprConsent = {
      readonly addtlConsent?: string;
      readonly apiVersion?: number;
      readonly consentString?: string;
      readonly gdprApplies?: boolean;
      readonly vendorData?: any;
    };

    export type BidderRequestBid = {
      readonly bidder: prebidjs.BidderCode;
      readonly adUnitCode: string;
      readonly auctionId: string;

      readonly sizes: [number, number][];
      readonly mediaTypes: prebidjs.IMediaTypes;

      readonly bidId?: string;
      readonly bidderRequestId: string;

      readonly deferBilling?: boolean;
      readonly src: 's2s' | 'client';
      readonly transactionId?: string;

      readonly ortb2: prebidjs.firstpartydata.PrebidFirstPartyData;
      readonly ortb2Imp?: prebidjs.IOrtb2Imp;

      readonly serverResponseTimeMs?: number;
    };

    export type BidderRequests = {
      readonly adUnitsS2SCopy?: IAdUnit[];
      readonly auctionId?: string;
      readonly auctionStart?: number;
      readonly bidderCode?: BidderCode;
      readonly bidderRequestId?: string;
      readonly bids?: BidderRequestBid[];
      readonly gdprConsent?: GdprConsent;
      /**
       * different functions to manage metrics
       */
      readonly metrics?: any;
      readonly ortb2?: firstpartydata.PrebidFirstPartyData;
      readonly refererInfo?: any;
      readonly src?: string;
      readonly start?: number;
      readonly timeout?: number;
      readonly uniquePbsTid?: string;
    };

    export type AuctionObject = {
      /**
       * The ad unit codes that are participating in the auction.
       *
       * Note that ad unit codes may appear multiple times. This is likely caused by prebid
       * twin ad unit feature
       */
      readonly adUnitCodes: string[];
      readonly adUnits?: IAdUnit[];
      readonly auctionId: string;
      readonly auctionStatus?: 'inProgress' | 'completed';
      readonly bidderRequests?: BidderRequests[];
      readonly bidsReceived?: prebidjs.BidResponse[];
      readonly bidsRejected?: NoBidObject[];
      /**
       * different functions to manage metrics
       */
      readonly metrics?: any;
      readonly noBids?: NoBidObject[];
      readonly seatNonBids?: any[];
      readonly timeout?: number;
      readonly timestamp?: number;

      /**
       * This is probably always empty, because when the auction ends, the results must be sent
       * back to the ad server. After that, the winners will be determined.
       */
      readonly winningBids: prebidjs.BidResponse[];
    };

    export type NoBidObject = {
      /**
       * unique identifier by prebid for a creative returned in an auction
       */
      readonly adId: string;

      /**
       * The DOM ID of the ad unit
       */
      readonly adUnitCode: string;
      readonly adUnitId?: string;
      readonly auctionId: string;
      readonly bidId?: string;
      /**
       * the current count of the bid requests on the page
       * (each request increases the count)
       */
      readonly bidRequestsCount?: number;
      readonly bidder: string;
      readonly bidderCode: string;
      readonly bidderRequestId?: string;
      /**
       * the current count of the bidder requests on the page
       * (each request to the bidder increases the count)
       */
      readonly bidderRequestsCount?: number;
      /**
       * the current count of auctions the bidder won
       */
      readonly bidderWinsCount?: number;
      readonly floorData?: floors.IFloorConfig;
      readonly mediaTypes?: IMediaTypes;
      /**
       * different functions to manage metrics
       */
      readonly metrics?: any;
      readonly ortb2?: firstpartydata.PrebidFirstPartyData;
      readonly ortb2Imp?: IOrtb2Imp;
      /**
       * provider specific params
       */
      readonly params?: any;
      readonly schain?: SupplyChainObject.ISupplyChainObject;
      readonly sizes?: [number, number][];
      readonly src?: 'client' | 's2s';
      readonly timeout?: number;
      readonly transactionId?: string;
      readonly userId?: userSync.UserIds;
      readonly userIdsAsEids?: any;
    };
  }

  export namespace currency {
    /**
     * All supported currencies
     */
    export type ICurrency = 'EUR' | 'USD' | 'GBP';

    export type IBidderCurrencyDefault = {
      [bidder in BidderCode]: ICurrency;
    };

    export interface ICurrencyConfig {
      /**
       * ISO 4217 3-letter currency code.
       * If this value is present, the currency conversion feature is activated.
       */
      readonly adServerCurrency: ICurrency;

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
       * This option isn't used when the rates parameter is supplied.
       *
       * Prebid hosts a conversion file here: https://currency.prebid.org/latest.json
       */
      readonly defaultRates: { USD: { EUR: number } };

      /**
       * configure bidder specific currencies.
       *
       * SSPs that make use of this feature
       * - Visx
       * - ...
       */
      readonly bidderCurrencyDefault?: IBidderCurrencyDefault;
    }
  }

  export namespace server {
    export type S2SConfig = IS2SConfig & IS2STestingConfig;

    /**
     * Endpoint definition
     */
    export type Endpoint = {
      /**
       * Endpoint that supports cookies
       */
      readonly p1Consent: string;

      /**
       * Endpoint that works without cookies
       */
      readonly noP1Consent?: string;
    };

    /**
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference.html#setConfig-Server-to-Server
     * @see https://docs.prebid.org/dev-docs/modules/prebidServer.html#configuration
     */
    export interface IS2SConfig {
      /**
       * Your Prebid Server account ID. This is obtained from whoever's hosting your Prebid Server.
       */
      readonly accountId: string;

      /**
       * Which bidders auctions should take place on the server side
       */
      readonly bidders: ReadonlyArray<BidderCode>;

      /**
       * An optional name for this configuration. This is necessary if you have multiple configurations and want to
       * reference them in a `BidObject` via the `module` property.
       */
      readonly name?: string;

      /**
       * Automatically includes all following options in the config with vendor's default values.
       * Individual properties can be overridden by including them in the config along with this setting.
       */
      readonly defaultVendor?: BidderCode;

      /**
       * Allow Prebid Server to bid on behalf of bidders that are not explicitly listed in the adUnit.
       * @default false
       */
      readonly allowUnknownBidderCodes?: boolean;

      /**
       * Enables this s2sConfig block - defaults to false
       */
      readonly enabled: boolean;

      /**
       * number of milliseconds allowed for the server-side auctions. This should be approximately 200ms-300ms less
       * than your Prebid.js timeout to allow for all bids to be returned in a timely manner.
       *
       * See the Additional Notes below for more information.
       */
      readonly timeout: number;

      /**
       * Adapter to use to connect to Prebid Server.
       *
       * Defaults to 'prebidServer'
       */
      readonly adapter: 'prebidServer';

      /**
       *  Defines the auction endpoint for the Prebid Server cluster
       */
      readonly endpoint: Endpoint;

      /**
       * Defines the cookie_sync endpoint for the Prebid Server cluster
       */
      readonly syncEndpoint: Endpoint;

      /**
       * Max number of userSync URLs that can be executed by Prebid Server cookie_sync per request. If not defined,
       * PBS will execute all userSync URLs included in the request.
       */
      readonly userSyncLimit?: number;

      /**
       * Maximum number of milliseconds allowed for each server-side userSync to load.
       * @default is 1000.
       */
      readonly syncTimeout?: number;

      /**
       * Whether or not PBS is allowed to perform “cooperative syncing” for bidders not on this page.
       * Publishers help each other improve match rates by allowing this.
       *
       * @default is true.
       */
      readonly coopSync?: boolean;

      /**
       * Configures the default TTL in the Prebid Server adapter to use when Prebid Server
       * does not return a bid TTL - 60 if not set
       */
      readonly defaultTtl?: number;

      /**
       * Arguments will be added to resulting OpenRTB payload to Prebid Server in every impression
       * object at `request.imp[].ext.BIDDER`.
       */
      readonly adapterOptions?: AdapterOptions;

      /**
       * Arguments will be added to resulting OpenRTB payload to Prebid Server in `request.ext.prebid`.
       *
       * @example
       * ```javascript
       * extPrebid: {
       *   cache: {
       *     vastxml: { returnCreative: false }
       *   },
       *   targeting: {
       *     pricegranularity: {"ranges": [{"max":40.00,"increment":1.00}]}
       *   }
       * }
       * ```
       */
      readonly extPrebid?: ExtPrebid;

      /**
       * Function to modify a bidder's sync url before the actual call to the sync endpoint.
       * Bidder must be enabled for s2sConfig.
       */
      readonly syncUrlModifier?: any;
    }

    /**
     * Only available with the s2sTesting module
     * @see https://docs.prebid.org/dev-docs/modules/s2sTesting.html
     */
    export interface IS2STestingConfig {
      /**
       * This attribute is required to enable the bidderControl and bidSource features.
       * This shouldn't be confused with the enabled: true flag which enables the entire server-to-server feature.
       *
       * Only available with the s2sTesting module
       */
      readonly testing?: boolean;

      /**
       * Using the `testServerOnly` flag means that all client requests will be suppressed
       * (those requests will not be made) whenever any bid requests from the 'A/B test group' result in a 'server'
       * bid request. The 'A/B test group' includes any requests whose source is controled by 's2sConfig.bidderControl'
       * or 'bidSource' at the adUnit level. This may give a clearer picture of how s2s performs without interference
       * from client bid requests.
       *
       * Only available with the s2sTesting module
       */
      readonly testServerOnly?: boolean;

      /**
       * Configure the client/server share for every bidder
       *
       * Only available with the s2sTesting module
       */
      readonly bidderControl?: {
        readonly [bidder in BidderCode]?: BidderControl;
      };
    }

    /**
     * Configure the A/B test between client and server
     */
    export type BidderControl = {
      /**
       * control the ratio between client and server.
       * `client` and `server` must add up to `100`.
       */
      readonly bidSource: BidSource;

      /**
       * As a Publisher, I'd like to run tests on one part or my site per one of the other use cases above. I'll use
       * the test KVP to confirm relative responses, so would like to have the hb_source test KVP coming in even on
       * pages where the server test isn't running.
       */
      readonly includeSourceKvp: boolean;
    };

    /**
     * control the ratio between client and server.
     * `client` and `server` must add up to `100`.
     */
    export type BidSource =
      | {
          /**
           * a number between 0 and 100
           */
          readonly client: number;

          /**
           * a number between 0 and 100
           */
          readonly server: number;
        }
      | {
          /**
           * if client should have 100% of the traffic, no server share is necessary
           */
          readonly client: 100;
        }
      | {
          /**
           * if server should have 100% of the traffic, no server share is necessary
           */
          readonly server: 100;
        };

    /**
     * Arguments will be added to resulting OpenRTB payload to Prebid Server in every impression
     * object at `request.imp[].ext.BIDDER`.
     */
    export type AdapterOptions = {
      readonly [bidder in BidderCode]?: any;
    };

    export type ExtPrebid = {
      /**
       * Prebid Server can be instructed to return additional SeatNonBid information about why bidders might not
       * have bid on certain adunits. You can get this extra information by setting `extPrebid.returnallbidstatus`
       * equal to `true`.
       *
       * Note that client-side analytics adapters can receive this data by listening to the seatNonBid event.
       *
       * @see [https://docs.prebid.org/prebid-server/endpoints/openrtb2/pbs-endpoint-auction.html#seat-non-bid]
       */
      readonly returnallbidstatus?: boolean;

      readonly cache?: {
        readonly vastxml?: {
          readonly returnCreative: boolean;
        };
      };

      /**
       * Targeting refers to strings which are sent to the adserver to make
       * header bidding possible.
       *
       * `request.ext.prebid.targeting` is an optional property which causes
       * Prebid Server to set these params on the response at
       * `response.seatbid[i].bid[j].ext.prebid.targeting`.
       */
      readonly targeting?: {
        /**
         * Defines how PBS quantizes bid prices into buckets
         */
        readonly pricegranularity: {
          /**
           * Non-overlapping price bucket definitions
           */
          readonly ranges: Readonly<priceGranularity.IPriceBucketConfig>;
        };

        /**
         * Whether to include targeting for the winning bids in
         * `response.seatbid[].bid[]`.
         *
         * @efault false.
         */
        readonly includewinners?: boolean;

        /**
         * Whether to include targeting for the best bid from each bidder in
         * `response.seatbid[].bid[]`
         *
         * @efault false.
         */
        readonly includebidderkeys?: boolean;

        /**
         * Whether to include the "hb_format" targeting key.
         *
         * @efault false.
         */
        readonly includeformat?: boolean;

        /**
         * If targeting is returned and this is true, PBS will choose the
         * highest value deal before choosing the highest value non-deal.
         *
         * @default false
         */
        readonly preferdeals?: boolean;
      };

      /**
       * Stored Requests are also allowed on the BidRequest. These work exactly the same way, but support storing
       * properties like timeouts and price granularity.
       *
       * @see https://docs.prebid.org/prebid-server/features/pbs-storedreqs-go.html
       */
      readonly storedrequest?: StoredRequest;

      /**
       * Custom properties that will be passed to analytics adapters.
       */
      readonly analytics?: {
        /**
         * Meta info about the versions of moli and of the publisher ad tag in use.
         */
        h5v: {
          /** initial value comes from the server and is overridden during runtime by the ad tag */
          moliVersion: string;

          /** replaced by configVersion */
          adTagVersion?: string;

          /** information will come from the server */
          configVersion?: string;

          /** information set by the configureFromEndpoint bundle */
          configLabel?: string;
        };
      };
    };

    /**
     * @see https://docs.prebid.org/prebid-server/features/pbs-storedreqs-go.html
     */
    export type StoredRequest = {
      readonly id: string;
    };
  }

  /**
   * ## GPT Pre-Auction Module
   *
   * Configuration types for the GPT Pre-Auction module.
   *
   * @see https://docs.prebid.org/dev-docs/modules/gpt-pre-auction.html
   */
  export namespace gptPreAuction {
    /**
     * @see https://docs.prebid.org/dev-docs/modules/gpt-pre-auction.html
     */
    export interface GptPreAuctionConfig {
      /**
       * allows turning off of module. Default value is true
       */
      readonly enabled?: boolean;

      /**
       * Removes extra network IDs when Multiple Customer Management is active.
       * Default is false.
       */
      readonly mcmEnabled?: boolean;

      /**
       * GPT slot matching function should match the customSlotMatching function sent to `setTargetingForGptAsync`
       */
      readonly customGptSlotMatching?: (gptSlotObj: any) => boolean;

      /**
       * Custom PB AdSlot function
       */
      readonly customPbAdSlot?: (adUnitCode: string, adServerSlot: string) => string;
    }
  }

  /**
   * @see http://prebid.org/overview/analytics.html
   * @see http://prebid.org/dev-docs/integrate-with-the-prebid-analytics-api.html
   * @see https://docs.prebid.org/dev-docs/publisher-api-reference/enableAnalytics.html
   */
  export namespace analytics {
    export type AnalyticsAdapter =
      | IAdagioAnalyticsAdapter
      | IAgmaAnalyticsAdapter
      | IGoogleAnalyticsAdapter;
    export type AnalyticsProviders = AnalyticsAdapter['provider'];

    /**
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/enableAnalytics.html
     */
    export interface IAnalyticsAdapter<T> {
      /**
       * Analytics adapter code
       */
      readonly provider: AnalyticsProviders;

      /**
       * Adapter specific options
       */
      readonly options: T;

      /**
       * Event include list; if provided, only these events will be forwarded to the adapter
       */
      readonly includeEvents?: string[];

      /**
       * Event blocklist; if provided, these events will not be forwarded to the adapter
       */
      readonly excludeEvents?: string[];
    }

    export interface IAgmaAnalyticsAdapterOptions {
      /**
       * provided by AGMA
       */
      readonly code: string;
    }

    /**
     * @see https://docs.prebid.org/dev-docs/analytics/agma.html
     */
    export interface IAgmaAnalyticsAdapter extends IAnalyticsAdapter<IAgmaAnalyticsAdapterOptions> {
      readonly provider: 'agma';
    }

    export interface IAdagioAnalyticsAdapterOptions {
      /**
       * Required. Provided by Adagio
       * @example `'1000'`
       */
      readonly organizationId: string;

      /**
       * Required. Provided by Adagio
       * @example `'my-website'`
       */
      readonly site: string;
    }

    /**
     * @see https://docs.prebid.org/dev-docs/analytics/adagio.html
     */
    export interface IAdagioAnalyticsAdapter
      extends IAnalyticsAdapter<IAdagioAnalyticsAdapterOptions> {
      readonly provider: 'adagio';
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

    export interface IGoogleAnalyticsAdapter
      extends IAnalyticsAdapter<IGoogleAnalyticsAdapterOptions> {
      readonly provider: 'ga';
    }
  }

  export namespace firstpartydata {
    export const enum ContentQuality {
      Unknown = 0,
      ProfessionallyProduced = 1,
      Prosumer = 2,
      UGC = 3
    }

    export interface OpenRtb2Site {
      /**
       * Array of IAB content categories of the site.
       */
      cat?: string[];

      /**
       * Array of IAB content categories that describe the current section of the site.
       */
      sectioncat?: string[];

      /**
       * Array of IAB content categories that describe the current page or view of the site.
       */
      pagecat?: string[];

      /**
       * Indicates if the site has been programmed to optimize layout when viewed on mobile devices, where 0 = no, 1 = yes.
       */
      mobile?: 0 | 1;

      /**
       * Indicates if the site has a privacy policy, where 0 = no, 1 = yes.
       */
      privacypolicy?: 0 | 1;

      /**
       * Comma separated list of keywords about the site.
       */
      keywords?: string;

      /**
       * URL of the page where the impression will be shown.
       */
      page?: string;

      /**
       * Details about the Content (Section 3.2.16) within the site.
       */
      content?: {
        title?: string;
        url?: string;
        prodq?: ContentQuality;

        /**
         * User rating of the content (e.g., number of stars, likes, etc.).
         */
        userrating?: number;

        /**
         * Comma separated list of keywords describing the content.
         */
        keywords?: string;

        /**
         * Content language using ISO-639-1-alpha-2.
         */
        language?: string;

        /**
         * Additional content data. Each object represents a different data source.
         */
        data?: OpenRtb2Data[];
      };

      /**
       * Placeholder for exchange-specific extensions to OpenRTB
       *
       * @see https://docs.prebid.org/features/firstPartyData.html#supplying-bidder-specific-data
       * @see https://adagioio.notion.site/Prebid-9-Adagio-required-updates-compatible-from-Prebid-9-5-f62d02d67d604e0187a800afefadb29d
       */
      ext?:
        | any // basically anything can still be put here
        | {
            data?: {
              /**
               * used by adagio. Example would be `article`
               */
              pagetype?: string;

              /**
               * used by adagio. Example would be `economy`
               */
              category?: string;
            };
          };
    }

    /**
     * Data segment that allows additional data about the related object (e.g. content).
     */
    export interface OpenRtb2Data {
      /**
       * Exchange-specific ID for the data provider.
       */
      id?: string;

      /**
       * Exchange-specific name for the data provider.
       */
      name: string;

      /**
       * Array of OpenRtb2Segment objects that contain the actual data values.
       */
      segment: OpenRtb2Segment[];

      /**
       * Placeholder for exchange-specific extensions to OpenRTB.
       */
      ext?: any;
    }

    /**
     * Segment objects are essentially key-value pairs that convey specific units of data.
     */
    export interface OpenRtb2Segment {
      /**
       * ID of the data segment specific to the data provider.
       */
      id?: string;
      /**
       * Name of the data segment specific to the data provider.
       */
      name?: string;
      /**
       * String representation of the data segment value.
       */
      value?: string;
      /**
       * Placeholder for exchange-specific extensions to OpenRTB.
       */
      ext?: any;
    }

    /**
     * Criteo specific extension for the OpenRTB User object
     */
    export interface CriteoOpenRtb2UserExt {
      readonly deviceidtype?: 'gaid' | 'idfa';

      /**
       * always set `deviceidtype` along.
       */
      readonly deviceid?: string;

      /**
       * @see https://publisherdocs.criteotilt.com/prebid/#hashed-emails
       */
      readonly data?: {
        readonly eids: CriteoOpenRtb2UserExtEids[];
      };
    }

    export interface CriteoOpenRtb2UserExtEids {
      /** domain here  */
      readonly source: string;

      readonly uids: CriteoOpenRtb2UserExtUid[];
    }

    export interface CriteoOpenRtb2UserExtUid {
      /**
       * hashed email value.
       *
       * ## Example
       *
       * Original Email: [john.doe@gmail.com]
       *
       * - `SHA256`: 375320dd9ae7ed408002f3768e16cb5f28c861062fd50dff9a3bff62e9dce4ef
       * - `MD5`: e13743a7f1db7f4246badd6fd6ff54ff
       * - `SHA256 of MD5`: 000e3171a5110c35c69d060112bd0ba55d9631c7c2ec93f1840e4570095b263a
       * */
      readonly id: string;
      /** always 3 */
      readonly atype: 3;

      readonly ext: {
        /**
         * hashing algorithm for the id (email)
         */
        readonly stype: 'cleartextemail' | 'hemsha256' | 'hemmd5' | 'hemsha256md5';
      };
    }

    export interface OpenRtb2User {
      /**
       * Year of birth as a 4-digit integer.
       */
      yob?: number;

      /**
       * "O" = known to be other (i.e., omitted is unknown).
       */
      gender?: 'M' | 'F' | 'O';

      /**
       * Comma separated list of keywords, interests, or intent.
       */
      keywords?: string;

      ext?: any & CriteoOpenRtb2UserExt;
    }

    export interface OpenRtb2Publisher {
      /**
       * Array of IAB content categories that describe the publisher.
       */
      cat?: string[];

      /**
       * Placeholder for exchange-specific extensions to OpenRTB
       */
      ext?: any;
    }

    /**
     * Entity that applied user parameters and the parameters they applied.
     */
    export interface OpenRtb2RegsExtDsaTransparency {
      /**
       * Domain of the entity that applied user parameters
       */
      domain: string;

      /**
       * Array for platform or sell-side use of any user parameters (using the list provided by DSA Transparency Taskforce).
       * Note: See definition and list of possible user parameters as listed here, applied consistently in both bid
       *      request and/or bid response.
       *
       * @see https://github.com/InteractiveAdvertisingBureau/openrtb/blob/main/extensions/community_extensions/dsa_transparency.md#user_parameters
       */
      params: Array<1 | 2 | 3>;
    }

    /**
     * Extension for DSA transparency information
     * @see https://github.com/InteractiveAdvertisingBureau/openrtb/blob/main/extensions/community_extensions/dsa_transparency.md
     */
    export interface OpenRtb2RegsExtDsa {
      dsa?: {
        /**
         * Flag to indicate if DSA information should be made available. This will signal if the bid request belongs to
         * an Online Platform/VLOP, such that a buyer should respond with DSA Transparency information based on the
         * pubrender value.
         *
         * 0 = Not required
         * 1 = Supported, bid responses with or without DSA object will be accepted
         * 2 = Required, bid responses without DSA object will not be accepted
         * 3 = Required, bid responses without DSA object will not be accepted, Publisher is an Online Platform
         */
        dsarequired: 0 | 1 | 2 | 3;

        /**
         * Flag to indicate if the publisher will render the DSA Transparency info. This will signal if the publisher is
         * able to and intends to render an icon or other appropriate user-facing symbol and display the DSA
         * transparency info to the end user.
         *
         * 0 = Publisher can't render
         * 1 = Publisher could render depending on adrender
         * 2 = Publisher will render
         */
        pubrender: 0 | 1 | 2;

        /**
         * Independent of pubrender, the publisher may need the transparency data for audit purposes.
         *
         * 0 = do not send transparency data
         * 1 = optional to send transparency data
         * 2 = send transparency data
         */
        datatopub: 0 | 1 | 2;

        /**
         * Array of objects of the entities that applied user parameters and the parameters they applied.
         */
        transparency?: OpenRtb2RegsExtDsaTransparency[];
      };
    }

    export interface OpenRtb2Regs {
      /**
       * Placeholder for exchange-specific extensions to OpenRTB
       */
      ext?: OpenRtb2RegsExtDsa;
    }

    export interface PrebidFirstPartyData {
      site?: OpenRtb2Site;

      user?: OpenRtb2User;

      publisher?: OpenRtb2Publisher;

      /**
       * This object contains any legal, governmental, or industry regulations that apply to the request. The
       * coppa flag signals whether or not the request falls under the United States Federal Trade Commission’s
       * regulations for the United States Children’s Online Privacy Protection Act (“COPPA”)
       */
      regs?: OpenRtb2Regs;

      /**
       * community extensions
       */
      ext?:
        | {
            prebid?: {
              data?: {
                /**
                 * Publishers can constrain which bidders receive which user.ext.eids entries.
                 * See the [Prebid.js user ID permissions](https://docs.prebid.org/dev-docs/modules/userId.html#permissions) reference for background.
                 *
                 * @see https://docs.prebid.org/prebid-server/endpoints/openrtb2/pbs-endpoint-auction.html#eid-permissions
                 * @see https://docs.prebid.org/dev-docs/modules/userId.html#permissions
                 */
                eidpermissions?: Array<{
                  /**
                   * Which user.ext.eids.source is receiving the permissions, one entry per source is allowed
                   */
                  source: prebidjs.userSync.EIDSource;
                  /**
                   * Which bidders are allowed to receive the named eid source
                   */
                  permissions: Array<BidderCode | '*'>;
                }>;
              };
            };
          }
        | any;
    }

    /**
     * The OpenRTB 2.5 bid request object.
     */
    export type OpenRtb2 = PrebidFirstPartyData;
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
  export interface IPrebidJsConfig
    extends IImproveDigitalConfig,
      IRubiconConfig,
      IIndexExchangeConfig,
      IAdagioConfig {
    /**
     * Turn on debugging
     */
    readonly debug?: boolean;

    /**
     * global bidder timeout
     */
    readonly bidderTimeout?: number;

    /**
     * Prebid core adds a timeout on XMLHttpRequest request to terminate the request once auction is timedout.
     * Since Prebid is ignoring all the bids after timeout it does not make sense to continue the request after timeout.
     * However, you have the option to disable this by using
     *
     * @example
     * ```js
     * pbjs.setConfig({ disableAjaxTimeout: true });
     * ```
     */
    readonly disableAjaxTimeout?: boolean;

    /**
     * Prebid core adds a timeout buffer to extend the time that bidders have to return a bid after the auction closes.
     * This buffer is used to offset the “time slippage” of the setTimeout behavior in browsers. Prebid.js sets the
     * default value to *400ms*.
     *
     * You can change this value by setting `timeoutBuffer` to the amount of time you want to use. The following example
     * sets the buffer to 300ms.
     *
     * ```js
     * pbjs.setConfig({ timeoutBuffer: 300 });
     * ```
     *
     *
     * @default `400` ms
     */
    readonly timeoutBuffer?: number;

    /**
     * You can prevent Prebid.js from reading or writing cookies or HTML localstorage by setting this flag:
     *
     * ```js
     * pbjs.setConfig({ deviceAccess: false });
     * ```
     *
     * This can be useful in GDPR, CCPA, COPPA or other privacy scenarios where a publisher has determined that
     * header bidding should not read from or write the user’s device.
     *
     */
    readonly deviceAccess?: boolean;

    /**
     * Since browsers have a limit of how many requests they will allow to a specific domain before they block,
     * Prebid.js will queue auctions that would cause requests to a specific origin to exceed that limit.
     * The limit is different for each browser. Prebid.js defaults to a max of *4* requests per origin.
     *
     * @example most browsers allow at least 6 requests, but your results may vary for your user base.  Sometimes using all
     * `6` requests can impact performance negatively for users with poor internet connections.
     * ```js
     * pbjs.setConfig({ maxRequestsPerOrigin: 6 });
     * ```
     *
     * @example to emulate pre 1-x behavior and have all auctions queue (no concurrent auctions), you can set it to `1`.
     * ```js
     * pbjs.setConfig({ maxRequestsPerOrigin: 1 });
     * ```
     */
    readonly maxRequestsPerOrigin?:
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7
      | 8
      | 9
      | 10
      | 11
      | 12
      | 13
      | 14
      | 15
      | 16
      | 17
      | 18;

    /**
     * Prebid.js will loop upward through nested iframes to find the top-most referrer. This setting limits how many
     * iterations it will attempt before giving up and not setting referrer.
     *
     * @example
     * ```js
     * pbjs.setConfig({
     *   maxNestedIframes: 5   // default is 10
     * );
     * ```
     *
     * @default `10`
     */
    readonly maxNestedIframes?:
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7
      | 8
      | 9
      | 10
      | 11
      | 12
      | 13
      | 14
      | 15
      | 16
      | 17
      | 18;

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
     * Prebid.js currently allows for caching and reusing bids in  [a very narrowly defined scope](https://docs.prebid.org/dev-docs/faq.html#does-prebidjs-cache-bids).
     *
     * However, if you’d like, you can disable this feature and prevent Prebid.js from using anything but the latest bids for a given auction.
     * @see https://docs.prebid.org/dev-docs/faq.html#does-prebidjs-cache-bids
     * @default false
     */
    readonly useBidCache?: boolean;

    /**
     * When Bid Caching is turned on, a custom Filter Function can be defined to gain more granular control over which
     * “cached” bids can be used. This function will only be called for “cached” bids from previous auctions, not
     * “current” bids from the most recent auction. The function should take a single bid object argument, and return
     * true to use the cached bid, or false to not use the cached bid. For Example, to turn on Bid Caching, but exclude
     * cached video bids, you could do this:
     *
     * @example
     * ```javascript
     * pbjs.setConfig({
     *     useBidCache: true,
     *     bidCacheFilterFunction: bid => bid.mediaType !== 'video'
     * });
     * ```
     */
    readonly bidCacheFilterFunction?: (bid: any) => boolean;

    /**
     * Set the order in which bidders are called.
     *
     * @default `'random'`
     */
    readonly bidderSequence?: 'random' | 'fixed';

    /**
     * The auctionOptions object controls aspects related to auctions.
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#auction-options
     */
    readonly auctionOptions?: auctionOptions.IAuctionOptionsConfig;

    /**
     * By default, Prebid keeps in memory a log of every event since the initial page load, and makes it available to
     * analytics adapters and getEvents(). This can cause high memory usage on long-running single-page apps;
     * you can set a limit on how long events are preserved with eventHistoryTTL
     */
    readonly eventHistoryTTL?: number;

    /**
     * Set the publisher's domain where Prebid is running, for cross-domain iframe communication
     * @deprecated This API is deprecated. Please use ‘pageUrl’ instead.
     */
    readonly publisherDomain?: string;

    /**
     * Override the Prebid.js page referrer for some bidders.
     *
     * @example
     * ```js
     * pbjs.setConfig({ pageUrl: "https://example.com/index.html" })
     * ```
     */
    readonly pageUrl?: string;

    /**
     * This configuration defines the price bucket granularity setting that will be used for the hb_pb keyword.
     */
    readonly priceGranularity?: priceGranularity.PriceGranularityConfig;

    /**
     * The default Prebid price granularities cap out at $20, which isn't always convenient for video ads, which can
     * command more than $20. One solution is to just set up a custom price granularity as described above. Another approach is mediaTypePriceGranularity config that may be set to define granularities for each of five media types: banner, video, video-instream, video-outstream, and native. e.g.
     */
    readonly mediaTypePriceGranularity?: priceGranularity.IMediaTypePriceGranularityConfig;

    /**
     * The `targetingControls` object passed to pbjs.setConfig provides some options to influence how an auction's
     * targeting keys are generated and managed.
     */
    readonly targetingControls?: targetingcontrols.ITargetingControls;

    /**
     * 'Consent Management' module configuration
     *
     * @see https://prebid.org/dev-docs/modules/consentManagement.html
     */
    readonly consentManagement?: consent.IConsentManagementConfig;

    /**
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-realTimeData
     */
    readonly realTimeData?: realtimedata.IRealTimeDataConfig;

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

    /**
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference.html#setConfig-Server-to-Server
     */
    readonly s2sConfig?: server.S2SConfig | ReadonlyArray<server.S2SConfig>;

    /**
     * _GPT Pre-Auction Module_ must be enabled.
     *
     * @see https://docs.prebid.org/dev-docs/modules/gpt-pre-auction.html
     */
    readonly gptPreAuction?: gptPreAuction.GptPreAuctionConfig;

    /**
     * Publishers supply First Party Data (FPD) by specifying attributes as configuration.
     *
     * Note that supplying first party *user* data may require special consent in certain regions.
     * Prebid.js does *not* police the passing of user data as part of its GDPR or CCPA modules.
     *
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-fpd
     * @see https://docs.prebid.org/features/firstPartyData.html
     */
    readonly ortb2?: firstpartydata.PrebidFirstPartyData;

    /**
     * Floor price configuration
     *
     * Requires the prebid floor price module to be enabled
     *
     * @see https://docs.prebid.org/dev-docs/modules/floors.html#floors-defined-in-the-adunit
     */
    readonly floors?: floors.IFloorConfig;

    /**
     * ## Supply Chain Object Module Config
     *
     * @see https://docs.prebid.org/dev-docs/modules/schain.html
     */
    readonly schain?: schain.ISupplyChainConfig;

    /**
     * These identifiers are extremely powerful for discrepancy reconciliation, ad quality investigations, consent
     * audits, and a huge range of other applications. They also allow data appended to different requests (e.g. dealIds)
     * to be commingled downstream. For this reason, our publisher committee and Prebid.org counsel have decided to
     * require publisher opt-in to their inclusion in the bid stream. This means Prebid engineering changed every
     * openrtb request in the project to potentially transmit a null in these fields. Comments were added to bid
     * adapters not using OpenRTB that send them over the wire to confirm they can accept null values.
     */
    readonly enableTIDs?: boolean;

    readonly allowActivities?: activitycontrols.IAllowActivities;

    /**
     * Prebid offers an additional gvl mapping configuration that allows us to defined GVL IDs
     * for a module or bidder by name.
     *
     * This is useful in various cases
     *
     * 1. bidders that do not have a GVL ID defined in their adapter yet
     * 2. bidders where we use aliases. The alias is not part of the registry
     *
     * This is the static variant of the runtime configuration option through `pbjs.aliasBidder`
     *
     * @see https://docs.prebid.org/dev-docs/modules/tcfControl.html#page-integration
     * @see https://docs.prebid.org/dev-docs/publisher-api-reference/aliasBidder.html
     */
    readonly gvlMapping?: Record<string, number>;
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

    /**
     * OpenRTB page position value:
     *
     * - 0=unknown
     * - 1=above-the-fold
     * - 3=below-the-fold
     * - 4=header
     * - 5=footer
     * - 6=sidebar
     * - 7=full-screen
     *
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     */
    readonly pos?: 0 | 1 | 3 | 4 | 5 | 6 | 7;
  }

  /**
   * ## Supply Chain Object
   *
   * All supply chobject related types.
   *
   * @see https://docs.prebid.org/dev-docs/modules/schain.html
   */
  export namespace schain {
    export interface ISupplyChainConfig {
      /**
       * 'strict': In this mode, schain object will not be passed to adapters if it is invalid. Errors are thrown for
       * invalid schain object. 'relaxed': Errors are thrown for an invalid schain object but the invalid schain object
       * is still passed to adapters. 'off': No validations are performed and schain object is passed as-is to adapters.
       *
       * The default value is 'strict'
       */
      readonly validation: 'strict' | 'relaxed' | 'off';

      /**
       * This is the full Supply Chain object sent to bidders conforming to
       * the IAB OpenRTB SupplyChain Object Specification.
       *
       * @see https://github.com/InteractiveAdvertisingBureau/openrtb/blob/master/supplychainobject.md
       */
      readonly config: SupplyChainObject.ISupplyChainObject;
    }
  }

  export namespace video {
    export const enum Skip {
      NO = 0,
      YES = 1
    }

    /**
     * Open RTB Spec 2.5 Section 5.8 Protocols
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     */
    export const enum Protocol {
      VAST_1 = 1,
      VAST_2 = 2,
      VAST_3 = 3,
      VAST_1_WRAPPER = 4,
      VAST_2_WRAPPER = 5,
      VAST_3_WRAPPER = 6,
      VAST_4 = 7,
      VAST_4_WRAPPER = 8,
      DAAST_1 = 9,
      DAAST_1_WRAPPER = 10
    }

    /**
     * Open RTB Spec 2.5 Section 5.10 Playback Methods
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     */
    export const enum PlaybackMethod {
      AutoPlaySoundOff = 1,
      AutoPlaySoundOn = 2,
      ClickToPlay = 3,
      MousOver = 4,
      InViewportSoundsOn = 5,
      InViewportSoundsOff = 6
    }

    /**
     * Open RTB Spec 2.5 Section 5.6 Playback Methods
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     * @see [Prebid Server](https://docs.prebid.org/prebid-server/overview/prebid-server-overview.html)
     */
    export const enum Api {
      VPAID_1 = 1,
      VPAID_2 = 2,
      MRAID_1 = 3,
      ORMMA = 4,
      MRAID_2 = 5,
      MRAID_3 = 6
    }

    /**
     * Video placement type.
     *
     *   1: In-Stream
     *      Played before, during or after the streaming video content that the consumer has requested
     *      (e.g., Pre-roll, Mid-roll, Post-roll).
     *   2: In-Banner
     *      Exists within a web banner that leverages the banner space to deliver a video experience as
     *      opposed to another static or rich media format. The format relies on the existence of display
     *      ad inventory on the page for its deliver
     *   3: In-Article
     *      Loads and plays dynamically between paragraphs of editorial content; existing as a standalone
     *      branded message
     *   4: In-Feed
     *      Found in content, social, or product feeds
     *   5: Interstitial/Slider/Floating
     *
     *  *Highly recommended* because some bidders require more than context=outstream.
     *
     * @see [OpenRTB 2.5 specification, List 5.9 for Values](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
     */
    export const enum Placement {
      InStream = 1,
      InBanner = 2,
      InArticle = 3,
      InFeed = 4,
      Interstitial = 5
    }

    /**
     * @see [OpenRTB 2.6 specification, Plcmt Subtypes - Video](https://github.com/InteractiveAdvertisingBureau/AdCOM/blob/develop/AdCOM%20v1.0%20FINAL.md#list_plcmtsubtypesvideo)
     */
    export const enum Plcmt {
      Instream = 1,
      AccompanyingContent = 2,
      Interstitial = 3,
      NoContentStandalone = 4
    }

    /**
     * Open RTB Spec 2.5 Section 5.3 Creative Attributes
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     */
    export const enum CreativeAttributes {
      AudioAdAutoPlay = 1,
      AudioAdUserInitiated = 2,
      ExpandableAutomatic = 3,
      ExpandableOnClick = 4,
      ExpandableOnRollover = 5,
      InBannerVideoAdAutoPlay = 6,
      InBannerVideoAdClick = 7,
      Pop = 8,
      ProvocativeOrSuggestiveImagery = 9,
      ShakyFlashingFlickering = 10,
      Surveys = 11,
      TextOnly = 12,
      UserInteractive = 13,
      WindowsDialogOrAlertStyle = 14,
      HasAudioOnOffButton = 15,
      HasSkipButton = 16,
      AdobeFlash = 16
    }

    /**
     * Open RTB Spec 2.5 Section 5.7 Video Linearity
     *
     * @see https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
     */
    export const enum Linearity {
      LinerInStream = 1,
      NonLinearOverlay = 2
    }

    export type MimeType =
      | 'video/mp4'
      | 'video/webm'
      | 'video/flv'
      | 'video/H264'
      | 'video/ogg'
      | 'video/MPV';
  }

  /**
   * For AdUnits with MediaType: video
   *
   * @see https://docs.prebid.org/dev-docs/adunit-reference.html#adunitmediatypesvideo
   */
  export interface IMediaTypeVideo {
    /**
     * The video context, either `'instream'`, `'outstream'`, or `'adpod'` (for long-form videos).
     *
     * Defaults to ‘instream’
     */
    readonly context: 'outstream' | 'instream' | 'adpod';

    /**
     * Player size(s) that this ad unit can accept (width, height).
     */
    readonly playerSize: [number, number][] | [number, number] | undefined;

    /**
     * API frameworks supported
     *
     * Values:
     *   1: VPAID 1.0
     *   2: VPAID 2.0
     *   3: MRAID-1
     *   4: ORMMA
     *   5: MRAID-2
     *   6: MRAID-3
     *
     * *Recommended*
     *
     * @example `[1, 2]`
     * @see [Prebid Server](https://docs.prebid.org/prebid-server/overview/prebid-server-overview.html)
     */
    readonly api: video.Api[];

    /**
     * Content MIME types supported.
     *
     * *Require by OpenRTB when using [Prebid Server](https://docs.prebid.org/prebid-server/overview/prebid-server-overview.html).*
     *
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml#video
     * @example `['video/mp4','video/x-flv']`
     */
    readonly mimes: video.MimeType[];

    /**
     *
     * Array of supported video protocols. For list, see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf].
     *
     * *Required by OpenRTB when using [Prebid Server](https://docs.prebid.org/prebid-server/overview/prebid-server-overview.html).*
     *
     * Supported video bid response protocols
     * Values
     *   1: VAST 1.0
     *   2: VAST 2.0
     *   3: VAST 3.0
     *   4: VAST 1.0 Wrapper
     *   5: VAST 2.0 Wrapper
     *   6: VAST 3.0 Wrapper
     *   7: VAST 4.0
     *   8: VAST 4.0 Wrapper
     *   9: DAAST 1.0
     *  10: DAAST 1.0 Wrapper
     *
     * @example `[5, 6]`
     */
    readonly protocols: video.Protocol[];

    /**
     * Allowed playback methods.. Defines whether inventory is user-initiated or autoplay sound on/off
     * If none specified, all are allowed. For list, see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf].
     *
     * *Required by OpenRTB when using [Prebid Server](https://docs.prebid.org/prebid-server/overview/prebid-server-overview.html).*
     *
     * Values:
     *  1: Auto-play, sound on
     *  2: Auto-play, sound off
     *  3: Click-to-play
     *  4: mouse-over
     *  5: Initiates on Entering Viewport with Sound On
     *  6: Initiates on Entering Viewport with Sound Off by Default
     */
    readonly playbackmethod: video.PlaybackMethod[];

    /**
     * Minimum ad duration in seconds
     * @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly minduration: number;

    /**
     *  Maximum ad duration in seconds
     *  @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly maxduration: number;

    /**
     * Width of the video player in device independent pixels (DIPS) - *Recommended*
     * @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly w?: number;

    /**
     * Height of the video player in device independent pixels (DIPS) - *Recommended*
     * @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly h?: number;

    /**
     *  Indicates the start delay in seconds for pre-roll, mid-roll, or post-roll ad placements.
     *
     *  Possible values:
     *  > 0 Mid-Roll (value indicates start delay in second)
     *    0 Pre-Roll
     *   -1 Generic Mid-Roll
     *   -2, Generic Post-Roll
     *
     *  @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly startdelay: number;

    /**
     * Indicates if the player will allow the video to be skipped, where `0` = no, `1` = yes.
     *
     * If a bidder sends markup/creative that is itself skippable, the Bid object should include the attr array with
     * an element of 16 indicating skippable video
     */
    readonly skip: video.Skip;

    /**
     * Blocked creative attributes,
     *
     * @see [OpenRTB 2.5 specification, List 5.3 for values](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
     * @example `[3, 9]`
     */
    readonly battr?: video.CreativeAttributes[];

    /**
     * Video placement type.
     *
     *   1: In-Stream
     *      Played before, during or after the streaming video content that the consumer has requested
     *      (e.g., Pre-roll, Mid-roll, Post-roll).
     *   2: In-Banner
     *      Exists within a web banner that leverages the banner space to deliver a video experience as
     *      opposed to another static or rich media format. The format relies on the existence of display
     *      ad inventory on the page for its deliver
     *   3: In-Article
     *      Loads and plays dynamically between paragraphs of editorial content; existing as a standalone
     *      branded message
     *   4: In-Feed
     *      Found in content, social, or product feeds
     *   5: Interstitial/Slider/Floating
     *
     *  *Highly recommended* because some bidders require more than context=outstream.
     *
     * @see [OpenRTB 2.5 specification, List 5.9 for Values](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
     */
    readonly placement: video.Placement;

    /**
     * @see [OpenRTB 2.6 specification, Plcmt Subtypes -  Video](https://github.com/InteractiveAdvertisingBureau/AdCOM/blob/develop/AdCOM%20v1.0%20FINAL.md#list_plcmtsubtypesvideo)
     */
    readonly plcmt: video.Plcmt;

    /**
     * Minimum bit rate in Kbps.
     * @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly minbitrate?: number;

    /**
     * Maximum bit rate in Kbps.
     * @see [OpenRTB spec|https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf]
     */
    readonly maxbitrate?: number;

    /**
     * Indicates if the impression is linear or nonlinear
     * Values:
     *   1: Linear/In-Stream
     *   2: Non-Linear/Overlay.
     *
     * @see [OpenRTB spec](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
     */
    readonly linearity?: video.Linearity;

    /**
     * The renderer associated to the ad-unit. Only for mediaType = video.
     */
    readonly renderer?: IRenderer;
  }

  interface IMediaTypeNativeRequirement {
    /**
     * true if the field is required for the native ad
     */
    readonly required: boolean;

    /**
     * Prebid.js sends received asset values to a native template defined in your ad server using key-value targeting.
     * The key-value targeting pairs are passed to the ad server as query string parameters. In some cases, sending
     * native asset values as query string parameters may cause errors. For example, a long clickUrl value can exceed
     * an ad request URL limit, or special characters within a body can get mangled by URL encoding. In these cases,
     * you can opt to send URL-safe placeholder values to the ad server, and then in the native template, replace the
     * placeholder values with the actual native values through a non-URL request to and response from Prebid.js.
     *
     * Within mediaTypes.native, add sendId: true to any asset object you wish to send as a placeholder.
     * For example, to send body and clickUrl as placeholders
     *
     * ```
     * mediaTypes: {
     *   native: {
     *     body: {
     *       sendId: true
     *     },
     *     clickUrl: {
     *       sendId: true
     *     },
     *   },
     * },
     * ```
     *
     * Note: The creative designs must have the universal-prebid-creative included
     * ```
     * <script src="https://cdn.jsdelivr.net/npm/prebid-universal-creative@1.7.0/dist/native-trk.js"></script>
     * ```
     *
     * or for the latest version
     *
     * ```
     * <script src="https://cdn.jsdelivr.net/npm/prebid-universal-creative@latest/dist/native-trk.js"></script>
     * ```
     *
     * @see http://prebid.org/dev-docs/show-native-ads.html#sending-asset-placeholders
     */
    readonly sendId?: boolean;
  }

  /**
   * A few properties may have a `len` property that can be specified to allow the maximum length of text.
   */
  interface IMediaTypeNativeRequirementWithLength extends IMediaTypeNativeRequirement {
    /**
     * Maximum length of text, in characters.
     */
    readonly len?: number;
  }

  /**
   * NOTE: If you're using aspect_ratios in a native request sent to Prebid Server, the min_width and min_height
   * fields become required instead of optional. If these fields are not included, that native request will be rejected.
   */
  type MediaTypeNativeAspectRatio = {
    /**
     * The minimum width required for an image to serve (in pixels).
     */
    readonly min_width?: number;

    /**
     * The minimum height required for an image to serve (in pixels)
     */
    readonly min_height?: number;

    /**
     * This, combined with `ratio_height`, determines the required aspect ratio for an image that can serve.
     */

    readonly ratio_width: number;

    /**
     * This, combined with `ratio_width`, determines the required aspect ratio for an image that can serve.
     */
    readonly ratio_height: number;
  };

  /**
   * There are two methods for defining sizes for image-like assets (image and icon). Both are shown below,
   * but the first example (using sizes) is more widely supported by demand partners.
   *
   * - Using `mediaTypes.native.image.sizes` (or `mediaTypes.native.icon.sizes` for icons)
   * - Using `mediaTypes.native.image.aspect_ratios` (or `mediaTypes.native.icon.aspect_ratios` for icons)
   */
  interface IMediaTypeNativeRequirementImage extends IMediaTypeNativeRequirement {
    /**
     * All sizes this ad unit can accept.
     * @example `[400, 600]`
     * @example `[[300, 250], [300, 600]]`
     */
    readonly sizes?: [number, number] | [number, number][];

    /**
     * Alongside sizes, you can define allowed aspect ratios
     */
    readonly aspect_ratios?: MediaTypeNativeAspectRatio[];
  }

  /**
   * @see http://prebid.org/dev-docs/show-native-ads.html#native-ad-keys
   * @see https://docs.prebid.org/dev-docs/adunit-reference.html#adunitmediatypesnative
   */
  export interface IMediaTypeNative {
    /**
     * Defines whether or not to send the hb_native_ASSET targeting keys to the ad server. Defaults to `true` for now,
     * though we recommend setting this to `false` and utilizing one of the ways to define a native template.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     */
    readonly sendTargetingKeys?: boolean;

    /**
     * Used in the ‘AdUnit-Defined Creative Scenario’, this value controls the Native template right in the page.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     */
    readonly adTemplate?: string;

    /**
     * Used in the ‘Custom Renderer Scenario’, this points to javascript code that will produce the Native template.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     * @example ‘https://host/path.js’
     */
    readonly rendererUrl?: string;

    /**
     * Prebid.js defines “types” of native ad for you as a convenience. This way you have less code to maintain,
     * that is hopefully more descriptive of your intent.
     *
     * For now there is only the image type, but more will be added.
     *
     * The image native ad type implies the following required fields:
     *
     * - image
     * - title
     * - sponsoredBy
     * - clickUrl
     *
     * And the following optional fields:
     *
     * - body
     * - icon
     * - cta
     *
     *
     * @see http://prebid.org/dev-docs/show-native-ads.html#pre-defined-native-types
     */
    readonly type?: 'image';

    /**
     * The title of the ad, usually a call to action or a brand name.
     *
     * ad server key-value: `hb_native_title`
     */
    readonly title?: IMediaTypeNativeRequirementWithLength;

    /**
     * Text of the ad copy.
     *
     * ad server key-value: `hb_native_body`
     */
    readonly body?: IMediaTypeNativeRequirementWithLength;

    /**
     * Additional Text of the ad copy.
     *
     * ad server key-value: `hb_native_body2`
     */
    readonly body2?: IMediaTypeNativeRequirement;

    /**
     * The name of the brand associated with the ad.
     *
     * ad server key-value: `hb_native_brand`
     */
    readonly sponsoredBy?: IMediaTypeNativeRequirement;

    /**
     * The brand icon that will appear with the ad.
     *
     * ad server key-value: `hb_native_icon`
     */
    readonly icon?: IMediaTypeNativeRequirementImage;

    /**
     * A picture that is associated with the brand, or grabs the user's attention.
     *
     * ad server key-value: `hb_native_image`
     */
    readonly image?: IMediaTypeNativeRequirementImage;

    /**
     * Where the user will end up if they click the ad.
     *
     * ad server key-value: `hb_native_linkurl`
     */
    readonly clickUrl?: IMediaTypeNativeRequirement;

    /**
     * Text that can be displayed instead of the raw click URL. e.g, “Example.com/Specials”
     *
     * ad server key-value: `hb_native_displayUrl`
     */
    readonly displayUrl?: IMediaTypeNativeRequirement;

    /**
     * Link to the Privacy Policy of the Buyer, e.g. http://example.com/privacy
     *
     * ad server key-value: `hb_native_privacy`
     */
    readonly privacyLink?: IMediaTypeNativeRequirement;

    /**
     * Icon to display for the privacy link, e.g. http://example.com/privacy_icon.png
     *
     * ad server key-value: `hb_native_privicon`
     */
    readonly privacyIcon?: IMediaTypeNativeRequirement;

    /**
     * Call to Action text, e.g., “Click here for more information”.
     *
     * ad server key-value: `hb_native_cta`
     */
    readonly cta?: IMediaTypeNativeRequirement;

    /**
     * Rating information, e.g., “4” out of 5.
     *
     * ad server key-value: `hb_native_rating`
     */
    readonly rating?: IMediaTypeNativeRequirement;

    /**
     * The total downloads of the advertised application/product
     *
     * ad server key-value: `hb_native_downloads`
     */
    readonly downloads?: IMediaTypeNativeRequirement;

    /**
     * The total number of individuals who like the advertised application/product
     *
     * ad server key-value: `hb_native_likes`
     */
    readonly likes?: IMediaTypeNativeRequirement;

    /**
     * The non-sale price of the advertised application/product
     *
     * ad server key-value: `hb_native_likes`
     */
    readonly price?: IMediaTypeNativeRequirement;

    /**
     * The sale price of the advertised application/product
     *
     * ad server key-value: `hb_native_saleprice`
     */
    readonly salePrice?: IMediaTypeNativeRequirement;

    /**
     * Address of the Buyer/Store. e.g, “123 Main Street, Anywhere USA”
     *
     * ad server key-value: `hb_native_address`
     */
    readonly address?: IMediaTypeNativeRequirement;

    /**
     * Phone Number of the Buyer/Store. e.g, “(123) 456-7890”
     *
     * ad server key-value: `hb_native_phone`
     */
    readonly phone?: IMediaTypeNativeRequirement;
  }

  export interface ITitleAssetParams {
    /**
     * Maximum length of the text in the title element.
     * Recommended to be 25, 90, or 140.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly len: number;
  }

  export interface IImageAssetParams {
    /**
     * `type` can be either 1 (icon) or 3 (main image).
     * @see https://docs.prebid.org/prebid/native-implementation.html#312-image-asset
     */
    readonly type?: 1 | 3;

    /**
     * Minimum requested width of the image in pixels (recommended!).
     * This option should be used for any rescaling of images by the client.
     * Either `w` or `wmin` should be transmitted.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly wmin?: number;

    /**
     * Minimum requested height of the image in pixels (recommended!).
     * This option should be used for any rescaling of images by the client.
     * Either `h` or `hmin` should be transmitted.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly hmin?: number;

    /**
     * Exact width of	the	image	in pixels.
     * Either `w` or `wmin` should be transmitted.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly w?: number;

    /**
     * Exact height of the image in pixels.
     * Either `h` or `hmin` should be transmitted.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly h?: number;
  }

  export interface IDataAssetParams {
    /**
     * Based on the `type` (which stands for a specific field) bidders will respond with the appropriate data (check link for list of types).
     * @see https://docs.prebid.org/prebid/native-implementation.html#313-data-asset
     */
    readonly type: number;
  }

  export interface INativeAssetOrtb {
    /**
     * Unique asset ID, assigned by exchange. Typically a counter for the	array.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly id: number;
    /**
     * Set to 1 if asset is required. Defaults to 0.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly required?: 0 | 1;
  }

  export interface INativeImgAssetOrtb extends INativeAssetOrtb {
    /**
     * Image request.
     * @see https://docs.prebid.org/prebid/native-implementation.html#312-image-asset
     */
    readonly img: IImageAssetParams;
  }

  export interface INativeTitleAssetOrtb extends INativeAssetOrtb {
    /**
     * Title of the ad.
     * @see https://docs.prebid.org/prebid/native-implementation.html#311-title-asset
     */
    readonly title: ITitleAssetParams;
  }

  export interface INativeDataAssetOrtb extends INativeAssetOrtb {
    /**
     * Misc component like “sponsored by”, “rating”, likes”, or other fields that have been standardized in OpenRTB 1.2.
     * Based on the type (which stands for a specific field) bidders will respond with the appropriate data (check link for more info).
     * @see https://docs.prebid.org/prebid/native-implementation.html#313-data-asset
     */
    readonly data: IDataAssetParams;
  }

  export type NativeAssetOrtb = INativeImgAssetOrtb | INativeDataAssetOrtb | INativeTitleAssetOrtb;

  export interface INativeEventtrackers {
    /**
     * Type of event available for tracking.
     * 1 for impression
     * @see more event types on https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    event: number;
    /**
     * Array of the types of tracking available for the given event.
     * 1 for image-pixel tracking; 2 for javascript-based tracking; 500+ for exchange-specific.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    methods: number[];
  }

  export interface IOrtbNativeSpecs {
    /**
     * Version of the Native Markup version in use.
     * Defaults to '1.2'
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly ver?: string;

    /**
     * Components of the ad that will assembled using the template. An asset must have an id, used for matching the request with the response.
     * Each asset should additionally have one of the following properties (but may only contain one): title, img, data
     * @see https://docs.prebid.org/prebid/native-implementation.html#31-prebidjs-and-the-ortb-asset-fields
     */
    readonly assets: NativeAssetOrtb[];

    /**
     * Specifies the types of events the bidder can request to be tracked in the bid response, and which types of tracking
     * are available for each event type, and is included as an array in the request.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly eventtrackers?: INativeEventtrackers[];

    /**
     * Set  to  1  when  the  native  ad supports  buyer-specific  privacy notice.
     * @see https://www.iab.com/wp-content/uploads/2018/03/OpenRTB-Native-Ads-Specification-Final-1.2.pdf
     */
    readonly privacy?: 0 | 1;
  }

  export interface IMediaTypeNativeOrtb {
    /**
     * Used in the ‘AdUnit-Defined Creative Scenario’, this value controls the Native template right in the page.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     */
    readonly adTemplate?: string;

    /**
     * Used in the ‘Custom Renderer Scenario’, this points to javascript code that will produce the Native template.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     * @example ‘https://host/path.js’
     */
    readonly rendererUrl?: string;

    /**
     * OpenRTB configuration of the Native assets in the 1.2 native specs.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     */
    readonly ortb: IOrtbNativeSpecs;

    /**
     * DEPRECATED
     * Defines whether or not to send the hb_native_ASSET targeting keys to the ad server. Defaults to `false`.
     * @see https://docs.prebid.org/prebid/native-implementation.html#3-prebidjs-native-adunit-overview
     */
    readonly sendTargetingKeys?: boolean;
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

    /**
     * Defines properties of a native ad.
     *
     * @see http://prebid.org/dev-docs/show-native-ads.htm
     * @see http://prebid.org/adops/setting-up-prebid-native-in-dfp.html
     * @see http://prebid.org/dev-docs/examples/native-ad-example.html
     */
    readonly native?: IMediaTypeNative | IMediaTypeNativeOrtb;
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
     * Optional field, if set to true, buyer or adapter renderer will be preferred.
     * Default is true.
     */
    readonly backupOnly?: boolean;

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
   * It's also where you will configure bidders, e.g.:
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
     *
     * Moli allows to omit the `code` and will use the `domId` of the slot
     */
    readonly code?: string;

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

    /**
     * This is an optional configuration for publishers that have a pubstack.io integration.
     *
     * @see https://pubstack.io/
     * @see https://pubstack.freshdesk.com/support/solutions/articles/48000965600-how-to-implement-google-adx-
     * @see https://pubstack.freshdesk.com/support/solutions/articles/48000965702-how-to-custom-ad-unit-name-
     */
    readonly pubstack?: IPubstackConfig;

    /**
     * Configure additional information per ad unit that should be send along
     * with a prebid server auction call.
     */
    readonly ortb2Imp?: IOrtb2Imp;

    /**
     * Floors configuration over prebid priceFloor module.
     */
    readonly floors?: floors.IFloorsData;
  }

  export interface IPubstackConfig {
    /**
     * By default, the integration uses the adUnitCode defined in the Ad Unit.
     * If you want Pubstack to use another name, you just have to provide the desired value through
     * the `pubstack.adUnitName` property.
     *
     * This feature is very useful when a site implements a lazy-loading or a refresh strategy.
     * The following example shows you how to set a custom name, whatever the ad unit code is.
     *
     * @see https://pubstack.freshdesk.com/support/solutions/articles/48000965702-how-to-custom-ad-unit-name-
     */
    readonly adUnitName?: string;

    /**
     * This is required for Google Ad Manager integration.
     *
     * Within the Prebid configuration (client-side), every prebid adUnit must be matched with a GAM adUnit,
     * so that we can display the corresponding AdX revenue in Pubstack. In order to do that, you need to
     * add the field "pubstack"."adUnitPath" to all ad units. This adUnitPath must be constructed* as such:
     *
     *   `/networkId/top_level1/level2/level3` (same as the DFP adUnitPath)
     *
     * @see https://pubstack.freshdesk.com/support/solutions/articles/48000965600-how-to-implement-google-adx-
     */
    readonly adUnitPath?: string;

    /**
     * Allows the publisher to push arbitrary dimensions to pubstack.
     * Can only be used with coordination of pubstack so the data can actually be used.
     */
    readonly tags?: string[];
  }

  /**
   * custom prebid ortb2 extension. Mainly used for prebid server communication
   */
  export interface IOrtb2ImpPrebid {
    readonly bidder?: {
      readonly [Bidder in BidderCode]: any;
    };
    readonly storedrequest?: IOrtb2ImpStoredRequest;
  }

  export interface IOrtb2ImpStoredRequest {
    /**
     * Specify a stored request id
     */
    readonly id?: string;
  }

  /**
   * Adagio moved some of their logic into an RTD Module with Prebid 9.5.0.
   * The change also requires to put some additional information in the `adUnit.ortb2Imp.ext.data` object.
   *
   * @see https://adagioio.notion.site/Prebid-9-Adagio-required-updates-compatible-from-Prebid-9-5-f62d02d67d604e0187a800afefadb29d
   */
  export interface IOrtb2ImpDataAdagio {
    /**
     * Required - Former 'bids.params.adUnitElementId'
     */
    divId?: string;

    /**
     * Same as 'bids.params.placement'
     */
    placement?: string;
  }

  /**
   * Values passed by prebid during a prebid server auction call.
   *
   * @see https://github.com/prebid/Prebid.js/pull/6494
   * @see https://github.com/prebid/Prebid.js/issues/6528
   */
  export interface IOrtb2Imp {
    readonly ext?: {
      readonly data?: IOrtb2ImpDataAdagio | any;

      /**
       * custom prebid extensions
       */
      readonly prebid?: IOrtb2ImpPrebid;
    };
  }

  // Supported SSPs
  export const Adagio = 'adagio';
  export const AdaptMx = 'amx';
  export const Adform = 'adf';
  export const AdUp = 'aduptech';
  export const Criteo = 'criteo';
  export const ConnectAd = 'connectad';
  export const AppNexusAst = 'appnexusAst';
  export const AppNexus = 'appnexus';
  export const GumGum = 'gumgum';
  export const ImproveDigital = 'improvedigital';
  export const IndexExchange = 'ix';
  export const Invibes = 'invibes';
  export const NanoInteractive = 'nanointeractive';
  export const PubMatic = 'pubmatic';
  export const Ogury = 'ogury';
  export const OneTag = 'onetag';
  export const OpenX = 'openx';
  export const SmartAdServer = 'smartadserver';
  export const Smartx = 'smartx';
  export const Unruly = 'unruly';
  export const Teads = 'teads';
  export const TheTradeDesk = 'ttd';
  export const Triplelift = 'triplelift';
  export const Yieldlab = 'yieldlab';
  export const Seedtag = 'seedtag';
  export const Spotx = 'spotx';
  export const ShowHeroes = 'showheroesBs';
  export const StroeerCore = 'stroeerCore';
  export const StailaMedia = 'stailamedia';
  export const Xaxis = 'xhb';
  export const DSPX = 'dspx';
  export const RichAudience = 'ra'; // using the shorter alias
  export const Rubicon = 'rubicon';
  export const Recognified = 'rads';
  export const Visx = 'visx';
  export const Vlyby = 'vlyby';
  export const Orbidder = 'orbidder';

  /**
   * The bidder code is used to identify the different SSPs.
   */
  export type BidderCode =
    | typeof Adagio
    | typeof AdaptMx
    | typeof AdUp
    | typeof Adform
    | typeof ConnectAd
    | typeof Criteo
    | typeof AppNexusAst
    | typeof AppNexus
    | typeof GumGum
    | typeof ImproveDigital
    | typeof IndexExchange
    | typeof Invibes
    | typeof NanoInteractive
    | typeof PubMatic
    | typeof Ogury
    | typeof OneTag
    | typeof OpenX
    | typeof SmartAdServer
    | typeof Smartx
    | typeof Unruly
    | typeof Teads
    | typeof TheTradeDesk
    | typeof Triplelift
    | typeof Yieldlab
    | typeof Seedtag
    | typeof Spotx
    | typeof ShowHeroes
    | typeof StailaMedia
    | typeof StroeerCore
    | typeof Xaxis
    | typeof DSPX
    | typeof RichAudience
    | typeof Rubicon
    | typeof Recognified
    | typeof Visx
    | typeof Vlyby
    | typeof Orbidder;

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
     * Note: will be removed by the ad tag and thus hidden for prebid
     *
     * @see https://prebid.org/dev-docs/conditional-ad-units.html
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly labelAny?: string[];

    /**
     * Used for [conditional ads](https://prebid.org/dev-docs/conditional-ad-units.html).
     * Works with sizeConfig argument to [pbjs.setConfig](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads).
     *
     * Note: will be removed by the ad tag and thus hidden for prebid
     *
     * @see https://prebid.org/dev-docs/conditional-ad-units.html
     * @see https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads
     */
    readonly labelAll?: string[];

    /**
     * Only available with the s2sTesting module.
     * Overrides the global bidSource configuration
     */
    readonly bidSource?: server.BidSource;
  }

  /**
   * Adagio bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/adagio.html
   */
  export interface IAdagioParams {
    /**
     * Id of the Organization. Handed out by Adagio.
     * @example `'1010'`
     */
    readonly organizationId: string;

    /**
     * Name of the site. Handed out by Adagio.
     * - max length: 50
     *
     * @example `'mysite-com'`
     */
    readonly site: string;

    /**
     * Refers to the placement of an adunit in a page.
     * Must not contain any information about the type of device.
     * - max length: 30
     * - max distinctives values: 10
     *
     * @example `'ban_atf'`
     */
    readonly placement: string;

    /**
     * Refers to the adunit html attribute id in a page.
     */
    readonly adUnitElementId?: string;

    /**
     * If true, "adUnitElementId" must be removed. (Since Prebid.js@4.19)
     */
    readonly useAdUnitCodeAsAdUnitElementId?: boolean;

    /**
     * Describes what kind of content will be present in the page.
     * - max length: 30
     * - max distinctives values: 50
     * @example `'article'`
     */
    readonly pagetype?: string;

    /**
     * Category of the content displayed in the page.
     * - max length: 30
     * - max distinctives values: 50
     */
    readonly category?: string;

    /**
     *  Partial OpenRTB Native 1.2 request object. Supported fields are:
     * - context
     * -plcmttype
     *
     * @example `{context: 1, plcmttype: 2}`
     */
    readonly native?: any;

    /**
     * The splitKeyword parameter lets Adagio know that the traffic is eligible to be sent to a Direct Seat using the Optimised Prebid Server offering.
     * When it’s not included in the configuration, Adagio will only send the traffic to its resellers set up through the Demand Library.
     *
     * You can pick any value for splitKeyword (30 alphabetic-numeric string with dash and underscore), e.g. ss-pubmatic (standing for server-side pubmatic).
     * Once communicated to our team, any change made to its value needs to be communicated again (otw. traffic won’t be recognised as eligible for the Optimised Prebid Server offering)
     */
    readonly splitKeyword?: string;
  }

  export interface IAdagioBid extends IBidObject<typeof Adagio, IAdagioParams> {}

  /**
   * Adapt.mx bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/amx.html
   */
  export interface IAdaptMxParams {
    /**
     * @example 'cHJlYmlkLm9yZw'
     */
    readonly tagId: string;

    /**
     * Activate 100% fill ads
     */
    readonly testMode?: boolean;

    /**
     * Ad Unit ID used in reporting. Will default to bid.adUnitCode
     */
    readonly adUnitId?: string;
  }

  export interface IAdaptMxBid extends IBidObject<typeof AdaptMx, IAdaptMxParams> {}

  /**
   * Adform bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/adf.html
   */
  export interface IAdformParams {
    /**
     * @example 12345
     */
    readonly mid: number;

    /**
     * The Adform domain
     * @example  'adx.adform.net'
     */
    readonly adxDomain?: string;

    /**
     * An expected price type (net or gross) of bids
     * @example 'net'
     */
    readonly priceType?: 'net' | 'gross';

    /**
     * Comma-separated key-value pairs
     * @example 'city:NY'
     */
    readonly mkv?: string;

    /**
     * Comma-separated keywords
     * @example 'news,sport'
     */
    readonly mkw?: string;

    /**
     * Minimum CPM price
     * @example 2.55
     */
    readonly minp?: number;

    /**
     * Comma-separated creative dimentions
     * @example '300x250'
     */
    readonly cdims?: string;

    /**
     * Custom targeting URL
     * @example 'https://some.app/?home'
     */
    readonly url?: string;
  }

  export interface IAdformBid extends IBidObject<typeof Adform, IAdformParams> {}

  /**
   * AdUp Technology bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/aduptech
   */
  export interface IAdUpParams {
    /**
     * Unique publisher id
     * @example '1234'
     */
    readonly publisher: string;

    /**
     * Unique placement id per publisher
     * @example '5678'
     */
    readonly placement: string;

    /**
     * Semicolon separated list of keywords
     * @example 'urlaub;ibiza;mallorca'
     */
    readonly query?: string;

    /**
     * Impressions and clicks will not be tracked if enabled
     */
    readonly adtest?: boolean;
  }

  export interface IAdUpBid extends IBidObject<typeof AdUp, IAdUpParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/connectad.html
   */
  export interface IConnectAdParams {
    /**
     * 	The site ID from ConnectAd.
     */
    readonly siteId: number;

    /**
     * The network ID from ConnectAd.
     */
    readonly networkId: number;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/connectad.html
   */
  export interface IConnectAdBid extends IBidObject<typeof ConnectAd, IConnectAdParams> {}

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

  export interface ICriteoBid extends IBidObject<typeof Criteo, ICriteoParams> {}

  export interface IAppNexusASTKeyword {
    [key: string]: string[];
  }

  type AppNexusASTAppDeviceId =
    | { readonly idfa: string }
    | { readonly aaid: string }
    | { readonly md5udid: string }
    | { readonly shad1udid: string }
    | { readonly windowsadid: string };

  export interface IAppNexusASTApp {
    /**
     * The App ID.
     * @example 'B1O2W3M4AN.com.prebid.webview'
     */
    readonly id?: string;

    /**
     * Object that contains the advertising identifiers of the user (idfa, aaid, md5udid, sha1udid, or windowsadid).
     */
    readonly device_id: AppNexusASTAppDeviceId;

    /**
     * Object that contains the latitude (lat) and longitude (lng) of the user.
     */
    readonly geo?: {
      readonly lat: number;
      readonly lng: number;
    };
  }

  /**
   * AppNexus prebid server keyword object.
   */
  export interface IAppNexusASTPrebidServerKeyword {
    readonly key: string;

    readonly value: string[];
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
    readonly placementId: string | number;

    /**
     * If true, ads smaller than the values in your ad unit's sizes array will be allowed to serve.
     * Defaults to false.
     */
    readonly allowSmallerSizes?: boolean;

    /**
     * A set of key-value pairs applied to all ad slots on the page.
     * Mapped to query string segments for buy-side targeting.
     *
     * **Example:**
     *
     * ```js
     * keywords: { genre: ['rock', 'pop'] }
     * ```
     *
     * for prebid server: keywords:
     * ```js
     * [ { key: 'genre', value: ['rock', 'pop'] } ]
     * ``
     */
    readonly keywords?: IAppNexusASTKeyword | IAppNexusASTPrebidServerKeyword[];

    /**
     * Sets a floor price for the bid that is returned.
     */
    readonly reserve?: number;

    /**
     * Indicates the type of supply for this placement. Possible values are web, mobile_web, mobile_app
     */
    readonly supply_type?: 'web' | 'mobile_web' | 'mobile_app';

    /**
     * If true, Appnexus will return net price to Prebid.js after publisher payment rules have been applied.
     */
    readonly use_pmt_rule?: boolean;

    /**
     * 	Identify the placement as above or below the fold.
     * 	Allowed values:
     * 	- Unknown: unknown
     * 	- Above the fold: above
     * 	- Below the fold: below
     */
    readonly position?: 'above' | 'below' | 'unknown';

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
      readonly playback_method?: Array<
        | 'auto_play_sound_on'
        | 'auto_play_sound_off'
        | 'click_to_play'
        | 'mouseover'
        | 'auto_play_sound_unknown'
      >;

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

    /**
     * AppNexus supports using prebid within a mobile app’s webview.
     * If you are interested in using an SDK, please see Prebid Mobile instead.
     */
    readonly app?: IAppNexusASTApp;
  }

  /**
   * All available app nexus bidder codes and aliases
   *
   * @see https://docs.prebid.org/dev-docs/bidders/stailamedia.html
   */
  type AppNexusAliases = typeof AppNexusAst | typeof AppNexus | typeof StailaMedia;

  /**
   * AppNexus bid object.
   */
  export interface IAppNexusASTBid extends IBidObject<AppNexusAliases, IAppNexusASTParams> {}

  export interface IGumGumParams {
    /**
     * TrackingID.
     * required for all bid requests tracking a single domain or site
     *
     * @example `'ggumtest'`
     */
    readonly zone: string;

    /**
     * PublisherId
     * required for all bid requests tracking multiple domains or sites
     *
     * @example `123`
     */
    readonly pubId?: number;

    /**
     * Iris.tv ID
     *
     * @example `'iris_6f9285823a4'`
     */
    readonly irisid?: string;

    /**
     * Iris.tv segments
     * @example `'segment1,segment2'`
     */
    readonly iriscat?: string;

    /**
     * Slot ID
     * required for slot placement only
     *
     * @example `9`
     */
    readonly slot?: number | string;

    /**
     * Product Type
     * required for new supported products like ‘skins’
     */
    readonly product?: 'skins';
  }

  /**
   * ## GumGum Bid params
   *
   * GumGum has a few special fields to determine the actual "product" being requested.
   *
   * `data.pi`:
   * - `2` : inscreen
   * - `3` : inslot
   * - `5` : native (ICV)
   * - `6` : invideo
   * - `7` : video
   * - `8` : skins
   *
   * @see https://docs.prebid.org/dev-docs/bidders/gumgum.html
   * @see https://github.com/prebid/Prebid.js/blob/822c09e5e10077528431054e90073bc4d58099f7/modules/gumgumBidAdapter.js#L355-L370
   */

  export interface IGumGumBid extends IBidObject<typeof GumGum, IGumGumParams> {}

  /**
   * ImproveDigital bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/improvedigitalBidAdapter.js
   * @see https://prebid.org/dev-docs/bidders/improvedigital.html
   */
  export interface IImproveDigitalParams {
    /**
     * The placement ID from Improve Digital.
     */
    readonly placementId: number;

    /**
     * The publisher ID from Improve Digital.
     */
    readonly publisherId: number;
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
  export interface IImproveDigitalBid
    extends IBidObject<typeof ImproveDigital, IImproveDigitalParams> {}

  /**
   * IndexExchange bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/ixBidAdapter.js
   * @see Documentation https://docs.prebid.org/dev-docs/bidders/ix.html
   */
  export interface IIndexExchangeParams {
    /**
     * An IX-specific identifier that is associated with a specific size on this ad unit. This is similar to
     * a placement ID or an ad unit ID that some other modules have.
     */
    readonly siteId: string | number;

    /**
     * The single size associated with the site ID. It should be one of the sizes listed in the ad unit under
     * `adUnits[].sizes` or `adUnits[].mediaTypes.banner.sizes`.
     *
     * Note that the 'ix' Prebid Server bid adapter ignores this parameter.
     */
    readonly size?: [number, number];

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
  export interface IIndexExchangeBid
    extends IBidObject<typeof IndexExchange, IIndexExchangeParams> {}

  // ----- Invibes ----- //

  /**
   * Invibes bid parameters.
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/invibesBidAdapter.js
   * @see Documentation https://docs.prebid.org/dev-docs/bidders/invibes.html
   */
  export interface IInvibesParams {
    /**
     * The Invibes placement ID
     * @example `'1234567'`
     */
    readonly placementId: string;

    /**
     * Id of domain
     * @example `1001`
     */
    readonly domainId?: number;

    /**
     * Custom test domain
     * @example https://bid.videostep.com/Bid/VideoAdContent
     */
    readonly customEndpoint?: number;
  }

  export interface IInvibesBid extends IBidObject<typeof Invibes, IInvibesParams> {}

  export interface IPrebidServerBidParams {
    /**
     * this must reference the `name` of an `s2sConfig` object
     */
    readonly configName: string;
  }
  /**
   * The prebid server bid object is special as it doesn't user the `bidder` property, but rather a `module` property.
   *
   * @see https://github.com/prebid/Prebid.js/issues/7688
   * @see https://github.com/prebid/Prebid.js/issues/8668
   * @see https://github.com/prebid/Prebid.js/pull/9470
   * @see https://docs.prebid.org/dev-docs/adunit-reference.html#stored-imp
   */
  export interface IPrebidServerBid
    extends Omit<IBidObject<any, IPrebidServerBidParams>, 'bidder'> {
    /** bidder is not used and can be left out */
    readonly bidder?: never;
    readonly module: 'pbsBidAdapter';
    readonly params: IPrebidServerBidParams;

    readonly ortb2Imp: IOrtb2Imp & {
      readonly ext?: {
        readonly prebid: IOrtb2ImpPrebid & {
          /**
           * stored request is required for prebid server calls
           */
          readonly storedrequest: IOrtb2ImpStoredRequest;
        };
      };
    };
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

    /**
     * Oustream AdUnit described in Blue BillyWig UI. This field is mandatory if mimeType is described as video and
     * context is outstream (i.e., for outstream videos).
     *
     * The code calls this 'rendererCode'.
     *
     * @example 'renderer_test_pubmatic'
     */
    readonly outstreamAU?: string;

    /**
     * Vide parameters. Required if mediaType contains `video`.
     */
    readonly video?: {
      /**
       * @see https://www.iana.org/assignments/media-types/media-types.xhtml#video
       * @example `['video/mp4','video/x-flv']`
       */
      readonly mimes: Array<
        'video/mp4' | 'video/webm' | 'video/flv' | 'video/H264' | 'video/ogg' | 'video/MPV'
      >;

      /**
       *  If ‘true’, user can skip ad
       */
      readonly skippable?: boolean;

      /**
       * Minimum ad duration in seconds
       */
      readonly minduration?: number;

      /**
       *  Maximum ad duration in seconds
       */
      readonly maxduration?: number;

      /**
       * Defines whether inventory is user-initiated or autoplay sound on/off
       * Values:
       *  1: Auto-play, sound on
       *  2: Auto-play, sound off
       *  3: Click-to-play
       *  4: mouse-over
       */
      readonly playbackmethod?: 1 | 2 | 3 | 4;

      /**
       * API frameworks supported
       * Values:
       *   1: VPAID 1.0
       *   2: VPAID 2.0
       *   3: MRAID-1
       *   4: ORMMA
       *   5: MRAID-2
       *
       * @example `[1, 2]`
       */
      readonly api?: Array<1 | 2 | 3 | 4 | 5>;

      /**
       * Supported video bid response protocols
       * Values
       *   1: VAST 1.0
       *   2: VAST 2.0
       *   3: VAST 3.0
       *   4: VAST 1.0 Wrapper
       *   5: VAST 2.0 Wrapper
       *   6: VAST 3.0 Wrapper
       *
       * @example `[5, 6]`
       */
      readonly protocols?: Array<1 | 2 | 3 | 4 | 5 | 6>;

      /**
       * Blocked creative attributes,
       *
       * @see [OpenRTB 2.5 specification, List 5.3 for values](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
       * @example `[3, 9]`
       */
      readonly battr?: number[];

      /**
       * Indicates if the impression is linear or nonlinear
       * Values:
       *   1: Linear/In-Stream
       *   2: Non-Linear/Overlay.
       */
      readonly linearity?: 1 | 2;

      /**
       * Video placement type.
       *
       *   1: In-Stream
       *   2: In-Banner
       *   3: In-Article
       *   4: In-Feed
       *   5: Interstitial/Slider/Floating
       *
       * @see [OpenRTB 2.5 specification, List 5.9 for Values](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf)
       */
      readonly placement?: 1 | 2 | 3 | 4 | 5;

      /**
       * Minimum bit rate in Kbps.
       */
      readonly minbitrate?: number;

      /**
       * Maximum bit rate in Kbps.
       */
      readonly maxbitrate?: number;
    };
  }

  export interface IPubMaticBid extends IBidObject<typeof PubMatic, IPubMaticParams> {}

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
  export interface INanoInteractiveBid
    extends IBidObject<typeof NanoInteractive, INanoInteractiveParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/ogury.html
   * @see https://ogury-ltd.gitbook.io/mobile-web/header-bidding/ogury-prebid.js-adapter-integration
   */
  export interface IOguryParams {
    /**
     * The asset key provided by Ogury
     * @example 'OGY-CA41D116484F'
     */
    readonly assetKey: string;

    /**
     * Your ad unit id configured with Ogury
     * @example '2c4d61d0-90aa-0139-0cda-0242ac120004'
     */
    readonly adUnitId: string;

    /**
     * Undocumented parameter
     *
     * @default false
     */
    readonly skipSizeCheck?: boolean;

    /**
     * The area based on which the thumbnail will be positioned.
     *
     * This value is ignored if the gravity is set to `CENTER`, `TOP_CENTER` or `BOTTOM_CENTER`
     *
     * @default `BOTTOM_CENTER`
     * @see https://ogury-ltd.gitbook.io/mobile-web/header-bidding/ogury-prebid.js-adapter-integration#customize-thumbnail-ad-position
     */
    readonly gravity?:
      | 'TOP_LEFT'
      | 'TOP_RIGHT'
      | 'TOP_CENTER'
      | 'BOTTOM_LEFT'
      | 'BOTTOM_RIGHT'
      | 'BOTTOM_CENTER'
      | 'CENTER';

    /**
     * distance on the x axis from the gravity area to thumbnail. Value must be in px.
     * @default 20
     */
    readonly xMargin?: number;

    /**
     * distance on the y axis from the gravity corner to thumbnail. Value must be in px.
     *
     * This value is ignored if the gravity is set to `CENTER`
     *
     * @default 20
     */
    readonly yMargin?: number;

    /**
     *
     * The headerSelector param has to be set with the identifier of your page's header. For example, if your header is defined by
     *
     * ```html
     * <header id="page-header-id" class="page-header-class">My Home page</header>
     * ```
     *
     * @example '#page-header-id'
     * @see https://ogury-ltd.gitbook.io/mobile-web/header-bidding/ogury-prebid.js-adapter-integration#customize-header-ad-position
     */
    readonly headerSelector?: string;

    /**
     * The headerStickiness param has to be set with the header type of your page. For the moment we supported only
     * two types of header `STICKY` or `NON_STICKY`.
     *
     * @default `STICKY`
     * @see https://ogury-ltd.gitbook.io/mobile-web/header-bidding/ogury-prebid.js-adapter-integration#customize-header-ad-position
     */
    readonly headerStickiness?: 'STICKY' | 'NON_STICKY';

    /**
     * You may choose to initially embed the header ad inside a predefined ad slot
     * @see https://ogury-ltd.gitbook.io/mobile-web/header-bidding/ogury-prebid.js-adapter-integration#customize-header-ad-position
     */
    readonly adSlotSelector?: string;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/ogury.html
   */
  export interface IOguryBid extends IBidObject<typeof Ogury, IOguryParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/onetag.html
   */
  export interface IOneTagParams {
    /**
     * The publisher’s ID provided by OneTag
     * @example `'386276e072'`
     */
    readonly pubId: string;

    /**
     * A set of custom key-value pairs
     */
    readonly ext: {
      /**
       * OneTag automatically maps placements using the `code` parameter of the Prebid ad unit.
       * You can override this, with this parameter
       */
      readonly placement_name?: string;

      /**
       * Other arbitrary key-values
       */
      readonly [key: string]: string | undefined;
    };
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/onetag.html
   */
  export interface IOneTagBid extends IBidObject<typeof OneTag, IOneTagParams> {}

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
  export interface IOpenxBid extends IBidObject<typeof OpenX, IOpenxParams> {}

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

    /**
     * Parameter object for instream video.
     *
     * This is also required for outstream
     */
    readonly video?: {
      /**
       * Maximum open RTB video protocol supported.
       *
       * Despite being marked as optionl, this is required for ad slots with
       * mediaType `video`
       *
       * @example 8 (VAST 4.0 wrapper)
       */
      readonly protocol: number;

      /**
       * Allowed values:
       *  - 1 (generic pre-roll, default)
       *  - 2 (generic mid-roll)
       *  - 3 (generic post-roll)
       */
      readonly startDelay?: 1 | 2 | 3;
    };
  }

  /**
   * @see https://help.smartadserver.com/s/article/Prebid-Server-setup
   */
  export interface ISmartAdServerPrebidServerParams {
    /**
     * The network ID.
     */
    readonly networkId: number;

    /**
     * The placement site ID
     * Optional, but must be filled along with pageId and formatId.
     *
     * @example 1234
     */
    readonly siteId?: number;

    /**
     * The placement page ID
     * Optional, but must be filled along with pageId and formatId.
     *
     * @examples 1234
     */
    readonly pageId?: number;

    /**
     *  The placement format ID
     *  Optional, but must be filled along with pageId and formatId.
     *  @example 1234
     */
    readonly formatId?: number;

    /**
     * Keyword targeting.
     * @example sport=tennis
     */
    readonly target?: string;
  }

  /**
   * Smart bid object
   */
  export interface ISmartAdServerBid
    extends IBidObject<
      typeof SmartAdServer,
      ISmartAdServerParams | ISmartAdServerPrebidServerParams
    > {}

  // ----- Smartx (smartclip) ----- //

  /**
   * Smartx (smartclip) bid parameters
   *
   * @see https://github.com/prebid/Prebid.js/blob/master/modules/smartxBidAdapter.js
   * @see Documentation https://docs.prebid.org/dev-docs/bidders/smartx.html
   */
  export interface ISmartxParams {
    /**
     * A unique ID.
     */
    readonly tagId: string;

    /**
     * A unique PublisherID.
     */
    readonly publisherId: string;

    /**
     * A unique SiteID.
     */
    readonly siteId: string;

    /**
     * Value of Bidfloor.
     * This is optional because this defaults to prebid.js's price floors module.
     */
    readonly bidfloor?: number;

    /**
     * Used Currency. (e.g. EUR, USD etc.)
     * This is optional because this defaults to 'EUR'.
     */
    readonly bidfloorcur?: currency.ICurrency;

    /**
     * Token that describes which context to play: ‘instream’ or ‘outstream’
     */
    readonly context?: string;

    /**
     * Object to set options on the smartx renderer. (Only required when setting mediaType.video.context = ‘outstream’)
     */
    readonly outstream_options?: {
      /**
       * ID of element that video ad should be rendered into.
       */
      readonly slot: string;

      /**
       * If the visible area is narrower than this size, no ad will be requested. The value is given in pixels. Default is 280.
       */
      readonly minAdWidth?: number;

      /**
       * The player will fill the whole width of the element it gets, to have it narrower a different maximum width can be defined in pixels. Default is 800.
       */
      readonly maxAdWidth?: number;

      /**
       * The player can show a freely definable text, a macro [remainingTime] in this string will be replaced with the remaining play time of the ad in seconds.
       */
      readonly title?: string;

      /**
       * In order to enable skipping from the start set the delay to 0, to show the skip button after 5 seconds set it to 5. Setting a general skipOffset is discouraged. Note that linear creatives carrying a skipsoffet attribute will override the general player setting. By default the player does not set a general skipoffset, so a skip button will only be shown, if an ad has a specific skipoffset attached.
       */
      readonly skipOffset?: number;

      /**
       * Per default the player will start fully expanded, if a valid ad can be played. Setting this option to false will trigger an expand animation instead once the player comes into view. Default is true.
       */
      readonly startOpen?: string;

      /**
       * By default the player will not close, but show the ending screen when an advertisement is complete (last frame of the ad and a replay button, if an advertisment comes with an endcard that will be shown). If set to false the player will collapse. Some VPAID creatives can cause issues with ending screen or replay behaviour. Default is true.
       */
      readonly endingScreen?: string;

      /**
       * You can specify a target bitrate for the creative, higher values will increase video quality but will cost bandwidth. Value is given in kpbs. Default is 700
       */
      readonly desiredBitrate?: number;

      /**
       * Defines the percentage of the player which has to be in the visible area to play and pause the advertisment. The default is 50.
       */
      readonly visibilityThreshold?: number;
    };

    /**
     * Boolean identifying whether the requests should be https or not (used to override the protocol if the page isn’t secure).
     */
    readonly secure?: boolean;

    /**
     * List of MIME types to allow in ad.
     */
    readonly mimes?: string[];

    /**
     * Set the current channel price floor in real time.
     */
    readonly price_floor?: number;

    /**
     * Minimum video ad duration in seconds
     */
    readonly min_duration?: number;

    /**
     * Maximum video ad duration in seconds
     */
    readonly max_duration?: number;
  }

  /**
   * Smartx bid object
   */
  export interface ISmartxBid extends IBidObject<typeof Smartx, ISmartxParams> {}

  /**
   * Unruly bid parameters
   *
   * @see https://docs.prebid.org/dev-docs/bidders/unruly.html
   */
  export interface IUnrulyParams {
    /**
     * The site ID from Unruly.
     */
    readonly siteId: number;

    /**
     * The targeting UUID from Unruly.
     *
     * @deprecated this field is still marked as required in the docs, but is never used nor provided by unruly
     */
    readonly targetingUUID?: string;
  }

  /**
   * Unruly bid object
   */
  export interface IUnrulyBid extends IBidObject<typeof Unruly, IUnrulyParams> {}

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
  export interface ITeadsBid extends IBidObject<typeof Teads, ITeadsParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/ttd.html
   */
  export interface ITheTradeDeskParams {
    /**
     * The TTD-provided supply source name.
     * @example `'supplier'`
     */
    readonly supplySourceId: string;

    /**
     * The publisher ID. If there is a sellers.json, this should be the same as the seller_id in the
     * sellers.json for the site being trafficked. If there is no sellers.json, this should be hardcoded to “1”.
     *
     * @example `'1427ab10f2e448057ed3b422'`
     */
    readonly publisherId: string;

    /**
     * This field is optional if GPID is passed through the GPT module https://docs.prebid.org/dev-docs/modules/gpt-pre-auction.html.
     * If that module isn’t used, the GPID value should be passed in this field.
     *
     * @see https://docs.prebid.org/dev-docs/modules/gpt-pre-auction.html
     */
    readonly placementId?: string;

    /**
     * Display banner targeting parameters.
     */
    readonly banner?: any;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/ttd.html
   */
  export interface ITheTradeDeskBid extends IBidObject<typeof TheTradeDesk, ITheTradeDeskParams> {}

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
    readonly adSize?: string;

    /**
     * A simple key-value map
     */
    readonly targeting?: { [key: string]: string };
  }

  /**
   * Yieldlab bid object
   */
  export interface IYieldlabBid extends IBidObject<typeof Yieldlab, IYieldlabParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/seedtag
   */
  export interface ISeedtagParams {
    /**
     * PublisherID povided by seedtag.
     * @example `0000-0000-01`
     */
    readonly publisherId: string;

    /**
     * AdUnitID provided by seedtag.
     * @example `00000`
     */
    readonly adUnitId: string;

    /**
     * Adunit placement
     */
    readonly placement: 'inScreen' | 'inArticle' | 'inBanner';
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/seedtag
   */
  export interface ISeedtagBid extends IBidObject<typeof Seedtag, ISeedtagParams> {}

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
      readonly mimes?: Array<
        'application/javascript' | 'video/mp4' | 'video/webm' | 'application/x-shockwave-flash'
      >;

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
  export interface ISpotXBid extends IBidObject<typeof Spotx, ISpotxParams> {}

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
  export interface IShowHeroesBid extends IBidObject<typeof ShowHeroes, IShowHeroesParams> {}

  export interface IXaxisParams {
    /**
     * placement id
     */
    readonly placementId: string;

    /**
     * A set of key-value pairs applied to all ad slots on the page.
     * Mapped to query string segments for buy-side targeting.
     *
     * **Example:**
     *
     * ```js
     * keywords: { genre: ['rock', 'pop'] }
     * ```
     */
    readonly keywords?: IAppNexusASTKeyword;

    /**
     * Sets a floor price for the bid that is returned.
     */
    readonly reserve?: number;
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
  export interface IXaxisBid extends IBidObject<typeof Xaxis, IXaxisParams> {}

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

      /**
       * configure the DOM ID of the ad slots where the creative should be injected
       */
      readonly injTagId?: string;
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
  export interface IDSPXBid extends IBidObject<typeof DSPX, IDSPXParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/richaudience.html
   */
  export interface IRichAudienceParams {
    /**
     * The placement ID from Rich Audience.
     * @example `'ADb1f40rmi'`
     */
    readonly pid: string;

    /**
     * Define if site or app.
     */
    readonly supplyType: 'site' | 'app';

    /**
     * Identifier For Advertisers
     *
     * @example `'AAAAAAAAA-BBBB-CCCC-1111-222222220000234234234234234'`
     */
    readonly ifa?: string;

    /**
     * A key-value applied only to the configured bid. This value is optional. Strings separated by semicolon.
     *
     * @example `car=mercedes;car=audi;`
     */
    readonly keywords?: string;

    /**
     * Object containing video targeting parameters.
     */
    readonly player?: {
      /** Start mode of the player open or close*/
      readonly init?: 'open' | 'close';
      /** End mode of the player open or close	 */
      readonly end?: 'open' | 'close';
      /** Choose the background color	 */
      readonly skin?: 'light' | 'dark';
    };
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/richaudience.html
   */
  export interface IRichAudienceBid extends IBidObject<typeof RichAudience, IRichAudienceParams> {}

  /**
   * @see http://prebid.org/dev-docs/bidders/rubicon.html
   */
  export interface IRubiconParams {
    /**
     * The publisher account ID
     * @example '4934'
     */
    readonly accountId: string;

    /**
     *  The site ID
     * @example '13945'
     */
    readonly siteId: string;

    /**
     * The zone ID
     * @example '23948'
     */
    readonly zoneId: string;

    /**
     * By default, the Magnite exchange will bid on only one media type in this order: video, banner, native.
     * Setting this flag to true will cause it to bid on all mediatypes.
     */
    readonly bidonmultiformat?: boolean;

    /**
     * Array of Rubicon Project size IDs. If not specified, the system will try to
     * convert from the AdUnit's mediaTypes.banner.sizes.
     */
    readonly sizes?: number[];

    /**
     * An object defining arbitrary key-value pairs concerning the page for use in targeting. The values must be arrays.
     * @example `{"rating":["5-star"], "prodtype":["tech","mobile"]}`
     */
    readonly inventory?: { [key: string]: string[] };

    /**
     * An object defining arbitrary key-value pairs concerning the visitor for use in targeting. The values must be arrays.
     * @example `{"ucat":["new"], "search":["iphone"]}`
     */
    readonly visitor?: { [key: string]: string[] };

    /**
     * Set the page position. Valid values are “atf” and “btf”.
     */
    readonly position?: 'atf' | 'btf';

    /**
     * Site-specific user ID may be reflected back in creatives for analysis.
     * Note that userId needs to be the same for all slots.
     */
    readonly userId?: string;

    /**
     * Sets the global floor – no bids will be made under this value.
     * @example 0.50
     */
    readonly floor?: number;

    /**
     * Video targeting parameters
     * Required for video
     */
    readonly video?: {
      /**
       * 203 for outstream and 201 for instream
       */
      readonly size_id?: 203 | 201;
      /**
       * ed	Indicates the language of the content video, in ISO 639-1/alpha2. Highly recommended for successful
       * monetization for pre-, mid-, and post-roll video ads. Not applicable for interstitial and outstream.
       *
       * @example 'en'
       */
      readonly language?: string;
    };
  }

  /**
   * @see http://prebid.org/dev-docs/bidders/rubicon.html
   */
  export interface IRubiconBid extends IBidObject<typeof Rubicon, IRubiconParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/vlyby
   */
  export interface IVlybyParams {
    /**
     * VLYBY PublisherId
     */
    readonly publisherId: string;

    /**
     * Optional placement id.
     */
    readonly placement?: string;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/visx.html
   */
  export interface IVlybyBid extends IBidObject<typeof Vlyby, IVlybyParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/visx.html
   */
  export interface IVisxParams {
    /**
     * The publisher's ad unit ID in VIS.X
     *
     * For prebid.js it should be string (number is probably fine too)
     * For prebid server it must be number
     *
     * @example `'903536'` or `903536`
     */
    readonly uid: string | number;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/visx.html
   */
  export interface IVisxBid extends IBidObject<typeof Visx, IVisxParams> {}

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/rads.html
   */
  export interface IRecognifiedParams {
    /**
     * Placement ID from Rads.
     * @example `'101'`
     */
    readonly placement: string;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidders/rads.html
   */
  export interface IRecognifiedBid extends IBidObject<typeof Recognified, IRecognifiedParams> {}

  /**
   * orbidder bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/orbidder.html
   */
  export interface IOrbidderParams {
    /**
     * Orbidder Account ID.
     * @example `"someAccount"`
     */
    readonly accountId: string;

    /**
     * Placement Id.
     * @example `"somePlacement"`
     */
    readonly placementId: string;

    /**
     * Placement floor price.
     * @example `1.23`
     */
    readonly bidfloor?: number;

    /**
     * Custom key/value object
     * @example `{"key":"value"}`
     */
    readonly keyValues?: { [key: string]: string };
  }

  export interface IOrbidderBid extends IBidObject<typeof Orbidder, IOrbidderParams> {}

  /**
   * Stroeer Core bid params
   *
   * @see https://docs.prebid.org/dev-docs/bidders/stroeerCore.html
   */
  export interface IStroeerParams {
    /**
     * Slot ID
     * @example `'06b782cc-091b-4f53-9cd2-0291679aa1ac'`
     */
    readonly sid: string;
  }

  export interface IStroeerCoreBid extends IBidObject<typeof StroeerCore, IStroeerParams> {}

  /**
   * Supported bid object types.
   */
  export type IBid =
    | IAdagioBid
    | IAdaptMxBid
    | IAdformBid
    | IAdUpBid
    | IConnectAdBid
    | ICriteoBid
    | IAppNexusASTBid
    | IGumGumBid
    | IImproveDigitalBid
    | IIndexExchangeBid
    | IInvibesBid
    | INanoInteractiveBid
    | IPrebidServerBid
    | IPubMaticBid
    | IOguryBid
    | IOneTagBid
    | IOpenxBid
    | ISmartAdServerBid
    | ISmartxBid
    | IUnrulyBid
    | ITeadsBid
    | ITheTradeDeskBid
    | IYieldlabBid
    | ISeedtagBid
    | ISpotXBid
    | IShowHeroesBid
    | IStroeerCoreBid
    | IXaxisBid
    | IDSPXBid
    | IRichAudienceBid
    | IRubiconBid
    | IRecognifiedBid
    | IVlybyBid
    | IVisxBid
    | IOrbidderBid;

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
    adUnits?: IAdUnit[];

    /**
     * Timeout for requesting the bids specified in milliseconds
     */
    readonly timeout?: number;

    /**
     *  Defines labels that may be matched on ad unit targeting conditions.
     */
    readonly labels?: string[];

    /**
     * Callback to execute when all the bid responses are back or the timeout hits.
     * @param bidResponses contains all valid SSP responses
     * @param timedOut - true if the handler was called due to hitting the timeout. false others
     * @param auctionId - bids back for auction
     */
    readonly bidsBackHandler?: (
      bidResponses: IBidResponsesMap | undefined,
      timedOut: boolean,
      auctionId: string
    ) => void;

    /**
     * Defines an auction ID to be used rather than having the system generate one.
     *
     * This can be useful if there are multiple wrappers on a page and a single auction ID
     * is desired to tie them together in analytics.
     */
    readonly auctionId?: string;

    /**
     * Additional first-party data to use for this auction only
     * @see https://docs.prebid.org/features/firstPartyData.html
     */
    readonly ortb2?: firstpartydata.OpenRtb2;

    /**
     * TTL buffer override for this auction.
     * @see [`setConfig({ttlBuffer})`](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-ttlBuffer)
     */
    readonly ttlBuffer?: number;
  }

  /**
   * Result returned from a requestBids call.
   * You can either use this or the callback.
   *
   * @see https://docs.prebid.org/dev-docs/publisher-api-reference/requestBids.html#result
   */
  export interface IRequestBidsResult {
    readonly bidResponses: IBidResponsesMap | undefined;
    readonly timedOut: boolean;
    readonly auctionId: string;
  }

  /**
   * The Object returned by the bidsBackHandler when requesting the Prebidjs bids.
   */
  export interface IBidResponsesMap {
    /**
     * The adUnit code, e.g. 'ad-presenter-desktop'
     */
    [adUnitCode: string]:
      | {
          /**
           * The bids that were returned by prebid
           */
          bids: prebidjs.BidResponse[];
        }
      | undefined;
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
   *    readonly bidder: typeof GumGum
   * 3. Add the interface to the `BidResponse` union type
   * 4. Match on the `bidder` (acts as the union discriminator) to get the specific response you want.
   *
   */
  export interface IBidResponse {
    /**
     * The unique identifier of a bid creative. It’s used by the line item’s creative
     */
    readonly requestId: string;

    /**
     * The bidder code.
     */
    readonly bidder: BidderCode;

    /**
     * the actual creative
     * Most of the time this a string containing the markup, but in some cases it's an object with more information.
     */
    readonly ad: string | any;

    /**
     * the unique prebid auction ID in which this bid response was created
     */
    readonly auctionId: string;

    /**
     * The `code` property in the adUnit object. This is usually the `domId` of the ad unit.
     */
    readonly adUnitCode: string;

    /**
     * The exact bid price from the bidder.
     */
    readonly cpm: number;

    readonly originalCpm?: number;

    /**
     * The unique identifier of a bid creative.
     */
    readonly adId: string;

    /**
     * The width of the returned creative size.
     * can be undefined for native / outstream media types
     */
    readonly width?: number;

    /**
     * The height of the returned creative size.
     * can be undefined for native / outstream media types
     */
    readonly height?: number;

    /**
     * @example 728x90
     */
    readonly size: string;

    /**
     * The media type of the bid response
     */
    readonly mediaType: 'banner' | 'video' | 'display';

    /**
     * Origin of the bid
     */
    readonly source: 'client' | 's2s';

    /**
     * The currency of the bid
     */
    readonly currency: string;

    /**
     * If currencyModule performed any currency conversion, this is the original currency.
     */
    readonly originalCurrency: string;

    /**
     * True if the CPM is the one this bidder will pay
     */
    readonly netRevenue: boolean;

    /**
     * (propably optional) - the time to live for this bid response in seconds
     */
    readonly ttl?: number;

    /**
     * If the bid is associated with a Deal, this field contains the deal ID.
     * @see https://docs.prebid.org/adops/deals.html
     */
    readonly dealId?: string;

    readonly creativeId?: number;

    /**
     * Status of the bid. Possible values: targetingSet, rendered
     */
    readonly status?: 'rendered' | 'targetingSet';

    /**
     *  The bid’s status message
     */
    readonly statusMessage: 'Bid returned empty or error response' | 'Bid available';

    // outstream
    readonly vastXml?: string;
    readonly vastImpUrl?: string;

    // native
    /**
     *  Contains native key value pairs.
     */
    readonly native: {
      readonly address?: string;
      readonly body?: string;
      readonly body2?: string;
      readonly cta?: string;
      readonly clickTrackers?: string[];
      readonly clickUrl?: string;
      readonly displayUrl?: string;
      readonly downloads?: string;
      readonly image?: {
        readonly url: string;
        readonly height: number;
        readonly width: number;
      };
      readonly impressionTrackers?: string[];
      readonly javascriptTrackers?: string;
      readonly likes?: any;
      readonly phone?: string;
      readonly price?: string;
      readonly privacyLink?: string;
      readonly rating?: string;
      readonly salePrice?: string;
      readonly sponsoredBy?: string;
      readonly title?: string;
    };

    /**
     * Contains all the adserver targeting parameters
     */
    readonly adserverTargeting: AdServerTargeting;
    readonly responseTimestamp: number;
    readonly requestTimestamp: number;
    readonly timeToRespond: number;

    /**
     * Additional meta data for this bid response
     */
    readonly meta?: {
      /**
       * A list of advertiser domains this bid is for.
       * This field is populated by at least some bidders.
       */
      readonly advertiserDomains?: string[];

      /**
       * Seen on Criteo bids
       */
      readonly networkName?: string;

      /**
       * Seen on IX bids
       */
      readonly networkId?: string;

      /**
       * Seen on IX bids
       */
      readonly brandId?: number;

      /**
       * Seen on IX bids
       */
      readonly brandName?: string;
    };

    /**
     * price bucket: 'low granularity'
     */
    readonly pbLg: string;
    /**
     * price bucket: 'medium granularity'
     */
    readonly pbMg: string;
    /**
     * price bucket: 'high granularity'
     */
    readonly pbHg: string;
    /**
     * price bucket: 'auto granularity'
     */
    readonly pbAg: string;
    /**
     * price bucket: 'dense granularity'
     */
    readonly pbDg: string;
    /**
     * price bucket: 'custom granularity'
     */
    readonly pbCg: string;
  }

  export type AdServerTargeting = {
    readonly hb_bidder: string;
    readonly hb_adid: string;
    readonly hb_pb: string;
    readonly hb_size: string;
    readonly hb_source: string;
    readonly hb_format: string;
    readonly hb_adomain: string;
  };

  export interface IGenericBidResponse extends IBidResponse {
    /**
     * The bidder code.
     *
     * Excludes all the bidder codes which have a more specific implementation.
     * Add more bidders by extending the union type, e.g.
     *
     * ```
     * Exclude<BidderCode, typeof AppNexusAst>;
     * ```
     */
    readonly bidder: Exclude<BidderCode, typeof GumGum>;

    /**
     * The bidder code.
     *
     * Excludes all the bidder codes which have a more specific implementation.
     * Add more bidders by extending the union type, e.g.
     *
     * ```
     * Exclude<BidderCode, typeof AppNexusAst>;
     * ```
     */
    readonly bidderCode: IGenericBidResponse['bidder'];
  }

  /**
   * The `bidResponse.ad` property contains this value if it's considered a
   * "wrapper" creative.
   */
  export interface IGumGumBidResponseWrapper {
    /**
     * Stands for _ad id_ and contains the format delivered.
     *
     * - `59` = in-screen cascade (former mobile skin)
     * - `39` = in-screen expandable (mobile expandable)
     */
    readonly auid: number;
  }

  export interface IGumGumBidResponse extends IBidResponse {
    /**
     * narrow this bid response type to gumgum
     */
    readonly bidder: typeof GumGum;

    /**
     * narrow this bid response type to gumgum
     */
    readonly bidderCode: IGumGumBidResponse['bidder'];

    /**
     * Contains the GumGum ad creative.
     *
     * If the `cw` field is set, then it's a "wrapper". Otherwise, it's considered
     * `markup` and is only a string.
     */
    readonly ad: IGumGumBidResponseWrapper | string;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/bidder-adaptor.html#interpreting-the-response
   */
  export type BidResponse = IGenericBidResponse | IGumGumBidResponse;

  /**
   * The bidderSettings object provides a way to define some behaviors for the platform
   * and specific adapters. The basic structure is a 'standard' section with defaults for
   * all adapters, and then one or more adapter-specific sections that override behavior
   * for that bidder.
   *
   * Defining bidderSettings is optional; the platform has default values for all of the options. Adapters may specify their own default settings, though this isn't common. Some sample scenarios where publishers may wish to alter the default settings:
   *
   * - using bidder-specific ad server targeting instead of Prebid-standard targeting
   * - passing additional information to the ad server
   * - adjusting the bid CPM sent to the ad server
   *
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
   */
  export type IBidderSettings = {
    /**
     * `standard` is used as a fallback if the SSP has no custom bidder settings
     */
    [bidder in BidderCode | 'standard']?: IBidderSetting;
  };

  /**
   * @see https://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
   */
  export interface IBidderSetting {
    /**
     * Define which key/value pairs are sent to the ad server.
     */
    readonly adserverTargeting?: IAdServerTargeting[];

    /**
     * Some bidders return gross prices instead of the net prices (what the publisher will actually get paid).
     * For example, a publisher's net price might be 15% below the returned gross price. In this case, the publisher may
     * want to adjust the bidder's returned price to run a true header bidding auction.
     * Otherwise, this bidder's gross price will unfairly win over your other demand sources who report the real price.
     */
    readonly bidCpmAdjustment?: (bidCpm: number, bid: IBidResponse) => number;

    /**
     * If adapter-specific targeting is specified, can be used to suppress the standard targeting for that adapter.
     * @default true
     */
    readonly sendStandardTargeting?: boolean;

    /**
     *  If custom adserverTargeting functions are specified that may generate empty keys, this can be used to suppress them.
     *  @default false
     */
    readonly suppressEmptyKeys?: boolean;

    /**
     * Would allow bids with a 0 CPM to be accepted by Prebid.js and could be passed to the ad server.
     * @default false
     */
    readonly allowZeroCpmBids?: boolean;

    /**
     * Allow use of cookies and local storage.
     * @default false (since prebid 7)
     */
    readonly storageAllowed?: boolean;

    /**
     * Allow adapters to bid with alternate bidder codes.
     * @default false (since prebid 7)
     */
    readonly allowAlternateBidderCodes?: boolean;

    /**
     *  Array of bidder codes for which an adapter can bid.
     * undefined or ['*'] will allow adapter to bid with any bidder code.
     */
    readonly allowedAlternateBidderCodes?: BidderCode[] | ['*'];
  }

  /**
   * For each bidder's bid, Prebid.js will set 4 keys (hb_bidder, hb_adid, hb_pb, hb_size) with their corresponding
   * values. The key value pair targeting is applied to the bid's corresponding ad unit. Your ad ops team will have the
   * ad server's line items target these keys.
   *
   *  If you'd like to customize the key value pairs, you can overwrite the settings as the below example shows.
   *  Note that once you updated the settings, let your ad ops team know about the change, so they can update the line
   *  item targeting accordingly. See the Ad Ops documentation for more information.
   *
   *  There's no need to include this code if you choose to use the below default setting.
   */
  export interface IAdServerTargeting {
    readonly key: string;

    /**
     * @param bidResponse returns the key value value. May be undefined, e.g. for `dealId` if not set
     */
    val(bidResponse: IBidResponse): string | undefined;
  }

  /**
   * @see https://docs.prebid.org/dev-docs/activity-controls.html
   */
  export namespace activitycontrols {
    /**
     * Always available
     * @see https://github.com/prebid/Prebid.js/blob/master/src/activities/params.js
     */
    export interface IActivityRuleDefaultParams {
      readonly component: string;
      readonly componentType: string;
      readonly componentName: string;
    }

    /**
     * Code of the bid adapter that `componentName` is an alias of.
     * May be the same as the component name.
     *
     * relevant for all activities, but only when componentType is 'bidder'.
     */
    type ACTIVITY_PARAM_ADAPTER_CODE = { readonly adapterCode: string };

    /**
     * Storage type - either 'html5' or 'cookie'.
     * Relevant for: accessDevice
     */
    type ACTIVITY_PARAM_STORAGE_TYPE = { readonly storageType: 'html5' | 'cookie' };

    /**
     * s2sConfig[].configName, used to identify a particular s2s instance
     * relevant for: fetchBids, but only when component is 'prebid.pbsBidAdapter'
     */
    type ACTIVITY_PARAM_S2S_NAME = { readonly configName: string };

    /**
     * user sync type - 'iframe' or 'pixel'
     * relevant for: syncUser
     */
    type ACTIVITY_PARAM_SYNC_TYPE = { readonly syncType: 'iframe' | 'pixel' };

    /**
     * user sync URL
     * relevant for: syncUser
     */
    type ACTIVITY_PARAM_SYNC_URL = { readonly syncUrl: string };

    export interface IActivityRule<Param> {
      /**
       * Condition function to use for this rule; the rule applies only if this returns true.
       * Receives a single object that contains activity parameters as input.
       * If omitted, the rule always applies.
       */
      readonly condition?: (param: Param & IActivityRuleDefaultParams) => boolean;

      /**
       * Whether the activity should be allowed when this rule applies.
       *
       * @efault is true
       */
      readonly allow?: boolean;

      /**
       * Priority of this rule compared to other rules; a lower number means
       * higher priority. See note on rule priority below.
       *
       * @default is 1
       */
      readonly priority?: number;
    }
    export interface IActivity<Param = {}> {
      /**
       * Whether the activity should be allowed if no other rule applies.
       *
       * @efault is true.
       */
      readonly default?: boolean;

      /**
       * `Rules` is an array of objects that a publisher can construct to provide fine-grained control over a given activity.
       * For instance, you could set up a series of rules that says:
       *
       * - Amongst the bid adapters, BidderA is always allowed to receive user first-party data
       * - Always let analytics adapters receive user first-party data
       * - Otherwise, let the active privacy modules decide
       * - if they refuse to decide, then the overall default is to allow the transmitting of user first-party data
       */
      readonly rules: IActivityRule<Param>[];
    }

    /**
     * Starting with version 7.52, Prebid.js introduced a centralized control mechanism for privacy-sensitive activities
     * - such as accessing device storage or sharing data with partners.  These controls are intended to serve as
     * building blocks for privacy protection mechanisms, allowing module developers or publishers to directly specify
     * what should be permitted or avoided in any given regulatory environment.
     *
     * @see https://docs.prebid.org/dev-docs/activity-controls.html
     * @see https://docs.prebid.org/dev-docs/activity-controls.html#configuration
     */
    export interface IAllowActivities {
      /**
       * A component wants to use device storage.
       *
       * Effect when denied: Storage is disabled
       */
      readonly accessDevice?: IActivity<ACTIVITY_PARAM_STORAGE_TYPE>;

      /**
       * A user ID or RTD submodule wants to add user IDs to outgoing requests
       *
       * Effect when denied: User IDs are discarded
       */
      readonly enrichEids?: IActivity;

      /**
       * A Real-Time Data (RTD) submodule wants to add user first-party data to outgoing requests (`user.data` in ORTB)
       *
       * Effect when denied: User FPD is discarded
       */
      readonly enrichUfpd?: IActivity;

      /**
       * A bid adapter wants to participate in an auction
       *
       * Effect when denied: Bidder is removed from the auction
       */
      readonly fetchBids?: IActivity<ACTIVITY_PARAM_S2S_NAME>;

      /**
       * An analytics adapter is being enabled through `pbjs.enableAnalytics`
       *
       * Effect when denied: Adapter remains disabled
       */
      readonly reportAnalytics?: IActivity;

      /**
       * A bid adapter wants to fetch a [user sync](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-Configure-User-Syncing)
       *
       * Effect when denied: User sync is skipped
       */
      readonly syncUser?: IActivity<ACTIVITY_PARAM_SYNC_TYPE & ACTIVITY_PARAM_SYNC_URL>;

      /**
       * A bid adapter or RTD submodule wants to access and/or transmit user IDs to their endpoint.
       *
       * Effect when denied: User IDs are hidden from the component
       */
      readonly transmitEids?: IActivity<ACTIVITY_PARAM_S2S_NAME>;

      /**
       * A bid adapter or RTD submodule wants to access and/or transmit precise geolocation data to their endpoint.
       *
       * Effect when denied: Component is allowed only 2-digit precision for latitude and longitude
       */
      readonly transmitPreciseGeo?: IActivity<ACTIVITY_PARAM_S2S_NAME>;

      /**
       * A bid adapter or RTD submodule wants to access and/or transmit globally unique transaction IDs to their endpoint.
       *
       * Effect when denied: Transaction IDs are hidden from the component
       */
      readonly transmitTid?: IActivity<ACTIVITY_PARAM_S2S_NAME>;

      /**
       * A bid adapter or RTD submodule wants to access and/or transmit user FPD to their endpoint.
       *
       * Effect when denied: User FPD is hidden from the component
       */
      readonly transmitUfpd?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
    }
  }

  export namespace floors {
    export interface IFloorConfig {
      /**
       * Disable floor price module
       *
       * @default true
       */
      readonly enabled?: boolean;

      /**
       * Configure the  floor price enforcement behaviour.
       */
      readonly enforcement?: IFloorEnforcementConfig;

      /**
       *  The mimimum CPM floor used by the Price Floors Module (as of 4.13).
       *  The Price Floors Module will take the greater of floorMin and the
       *  matched rule CPM when evaluating `getFloor()` and enforcing floors.
       */
      readonly floorMin?: number;

      /**
       * Optional atribute (as of prebid version 4.1) used to signal to the Floor Provider’s Analytics adapter their
       * floors are being applied. They can opt to log only floors that are applied when they are the provider.
       * If floorProvider is supplied in both the top level of the floors object and within the data object,
       * the data object’s configuration shall prevail.
       */
      readonly floorProvider?: string;

      /**
       *  `skipRate` is a random function whose input value is any integer 0 through 100 to determine when to skip all
       *  floor logic, where 0 is always use floor data and 100 is always skip floor data. The use case is for
       *  publishers or floor providers to learn bid behavior when floors are applied or skipped. Analytics adapters
       *  will have access to model version (if defined) when skipped is true to signal the Price Floors Module is in
       *  floors mode. If skipRate is supplied in both the root level of the floors object and within the data object,
       *  the skipRate configuration within the data object shall prevail.
       * @default 0
       */
      readonly skipRate?: number;

      /**
       * ## Package-Level Floors
       *
       * This approach is intended for scenarios where the Publisher or their Prebid managed service provider
       * periodically appends updated floor data to the Prebid.js package. In this model, there could be more floor
       * data present to cover AdUnits across many pages.
       *
       * By defining floor data with setConfig, the Price Floors Module will map GPT ad slots to AdUnits as needed.
       * It does this in the same way as the `setTargetingForGPTAsync()` function – first looking for an `AdUnit.code`
       * that matches the slot name, then looking for an `AdUnit.code` that matches the div id of the named GPT slot.
       */
      readonly data?: IFloorsData;
    }

    export interface IFloorEnforcementConfig {
      /**
       * If an endpoint URL (a Dynamic Floor) is defined, the Price Floors Module will attempt to fetch floor data from
       * the Floor Provider’s endpoint. When requestBids is called, the Price Floors Module will delay the auction up
       * to the supplied amount of time in floors.auctionDelay or as soon as the dynamic endpoint returns data,
       * whichever is first
       *
       * @default 0
       */
      readonly auctionDelay?: number;

      /**
       * The mimimum CPM floor used by the Price Floors Module (as of 4.13). The Price Floors Module will take the
       * greater of floorMin and the matched rule CPM when evaluating getFloor() and enforcing floors.
       */
      readonly floorMin?: number;
      /**
       * Enforce floors for deal bid requests.
       * @default false
       */
      readonly floorDeals?: boolean;

      /**
       * If `true`, the Price Floors Module will use the bidAdjustment function to adjust the floor per bidder.
       * If `false` (or no bidAdjustment function is provided), floors will not be adjusted. Note: Setting this
       * parameter to false may have unexpected results, such as signaling a gross floor when expecting net or vice versa.
       *
       * @default true
       */
      readonly bidAdjustment?: boolean;

      /**
       * If set to `true`, the Price Floors Module will provide floors to bid adapters for bid request matched rules and
       * suppress any bids not exceeding a matching floor. If set to `false`, the Price Floors Module will still provide
       * floors for bid adapters, there will be no floor enforcement.
       *
       * @default true
       */
      readonly enforceJS?: boolean;

      /**
       * If set to `true`, the Price Floors Module will signal to Prebid Server to pass floors to it’s bid adapters and
       * enforce floors. If set to `false`, the pbjs should still pass matched bid request floor data to PBS, however no
       * enforcement will take place.
       *
       * @default false
       */
      readonly enforcePBS?: boolean;

      /**
       * Controls behavior for dynamically retrieving floors.
       *
       * Make sure to set an `auctionDelay` if you use a floor price provider.
       */
      readonly endpoint?: IFloorEndpoint;
    }

    export interface IFloorEndpoint {
      /**
       * URL of endpoint to retrieve dynamic floor data.
       */
      readonly url: string;
    }

    export type IFloorSchemaFields = 'gptSlot' | 'adUnitCode' | 'mediaType' | 'size' | 'domain';

    /**
     * ## Floor price schema
     *
     * Configure under what conditions which floor price applies. This can be
     * arbitrarily complex or super simple.
     */
    export interface IFloorSchema {
      /**
       * configure the delimiter that separates the keys in the values
       * properties and converts them into fields.
       *
       * @default `|`
       */
      readonly delimiter: string;

      /**
       * A list of fields tha appear in the `values` key. Allows to configure
       * floor prices on different dimensions.
       *
       * Supported values are: `gptSlot`, `adUnitCode`, `mediaType`, `size`, `domain`
       */
      readonly fields: IFloorSchemaFields[];
    }

    /**
     * ## Floor values
     *
     * The values are a map from "condition" to "floor price".
     * Conditions are configured in the `schema`. The key must be separated by the
     * `separator` property value.
     *
     * `*` is a special key that acts as a wildcard as is used in case no schema
     * matches.
     */
    export interface IFloorValues {
      /**
       * key: Delimited field of attribute values that define a floor.
       * value: The floor value for this key.
       */
      [key: string]: number;
    }

    /**
     * IFloor module for adUnit.
     * @see https://docs.prebid.org/dev-docs/modules/floors.html
     */
    export interface IFloorsData {
      /**
       * Optional atribute (as of prebid version 4.2) used to signal to the Floor Provider’s Analytics adapter their
       * floors are being applied. They can opt to log only floors that are applied when they are the provider.
       * If floorProvider is supplied in both the top level of the floors object and within the data object,
       * the data object’s configuration shall prevail.
       */
      readonly floorProvider?: string;

      /**
       * Used by floor providers to train on model version performance.
       * The expectation is a floor provider’s analytics adapter will pass the
       * model verson back for algorithm training.
       */
      readonly modelVersion?: string;

      /**
       * The module supports two versions of the data schema. Version 1 allows for only one model to be applied in a
       * given data set, whereas Version 2 allows you to sample multiple models selected by supplied weights.
       * If no schema version is provided, the module will assume version 1 for the sake of backwards compatibility.
       *
       * @default 1
       */
      readonly floorsSchemaVersion?: 1 | 2;

      /**
       * `skipRate` is a random function whose input value is any integer 0 through 100 to determine when to skip all
       * floor logic, where 0 is always use floor data and 100 is always skip floor data. The use case is for publishers
       * or floor providers to learn bid behavior when floors are applied or skipped. Analytics adapters will have
       * access to model version (if defined) when skipped is true to signal the Price Floors Module is in floors mode.
       *
       * If `skipRate` is supplied in both the root level of the floors object and within the data object, the skipRate
       * configuration within the data object shall prevail.
       *
       * @default 0
       */
      readonly skipRate?: number;

      /**
       *  Currency of floor data. Floor Module will convert currency where
       *  necessary. See Currency section for more details.
       */
      readonly currency?: currency.ICurrency;

      /**
       * allows for flexible definition of how floor data is formatted.
       */
      readonly schema?: IFloorSchema;

      /**
       * A series of attributes representing a hash of floor data in a format
       * defined by the schema object.
       */
      readonly values?: IFloorValues;

      /**
       * Floor used if no matching rules are found.
       */
      readonly default?: number;
    }
  }
}
