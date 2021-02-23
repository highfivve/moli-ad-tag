// type definitions for DFP googletag
export namespace googletag {
  /**
   * Add googletag to global window instance
   */
  export interface IGoogleTagWindow {
    /**
     * Google Publisher Tag (gpt.js)
     * @see {@link https://developers.google.com/doubleclick-gpt/reference}
     */
    googletag: googletag.IGoogleTag;
  }

  export type Size = [number, number] | string;

  /**
   * Base service class that contains methods common for all services.
   * @template T type reference to return the proper service subclass
   */
  export interface IService<T extends IService<any>> {
    /**
     * This event is fired when a slot on the page has finished rendering.
     * The event is fired by the service that rendered the slot.
     *
     * Example: To listen to companion ads, add a listener to the companionAds service,
     *          not the pubads service.
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'slotRenderEnded',
      listener: (event: events.ISlotRenderEndedEvent) => void
    ): T;

    /**
     * This event is fired when an impression becomes viewable, according to the Active View criteria
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'impressionViewable',
      listener: (event: events.IImpressionViewableEvent) => void
    ): T;

    /**
     * This event is fired when the creative's iframe fires its load event. When rendering rich media ads in sync
     * rendering mode, no iframe is used so no SlotOnLoadEvent will be fired.
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'slotOnload',
      listener: (event: events.ISlotOnloadEvent) => void
    ): T;

    /**
     * This event is fired when an ad has been requested for a particular slot.
     *
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'slotRequested',
      listener: (event: events.ISlotRequestedEvent) => void
    ): T;

    /**
     * This event is fired when an ad response has been received for a particular slot.
     *
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'slotResponseReceived',
      listener: (event: events.ISlotResponseReceived) => void
    ): T;

    /**
     * This event is fired whenever the on-screen percentage of an ad slot's area changes.
     * The event is throttled and will not fire more often than once every 200ms.
     * @param eventType
     * @param listener
     */
    addEventListener(
      eventType: 'slotVisibilityChanged',
      listener: (event: events.ISlotVisibilityChangedEvent) => void
    ): T;

    /**
     * Get the list of slots associated with this service.
     */
    getSlots(): Array<IAdSlot>;
  }

  /**
   * ## PubAds Service
   *
   * Publisher Ads service. This service is used to fetch and show ads from your DFP account.
   *
   * @see {@link https://developers.google.com/doubleclick-gpt/reference|API Reference}
   */
  export interface IPubAdsService extends IService<IPubAdsService> {
    /**
     * Enables single request mode for fetching multiple ads at the same time.
     *
     * This requires all pubads slots to be defined and added to the pubads service prior
     * to enabling the service. Single request mode must be set before the service is enabled.
     *
     * @return Returns true if single request mode was enabled and false if it is impossible
     *         to enable single request mode because the method was called after the service was enabled.
     */
    enableSingleRequest(): boolean;

    /**
     * Enables async rendering mode to enable non-blocking fetching and rendering of ads. Because the service uses
     * asynchronous rendering by default, you only need to use this method to override a previous setting. Async mode
     * must be set before the service is enabled.
     *
     * @return Returns true if async rendering mode was enabled and false if it is impossible to enable async rendering
     *         mode because the method was called after the service was enabled.
     */
    enableAsyncRendering(): boolean;

    /**
     * Disables requests for ads on page load, but allows ads to be requested with a googletag.pubads().refresh() call.
     *
     * This should be set prior to enabling the service. Async mode must be used; otherwise it will be impossible
     * to request ads using refresh.
     */
    disableInitialLoad(): void;

    /**
     * Sets custom targeting parameters for a given key that apply to all pubads service ad slots.
     *
     * Calling this multiple times for the same key will overwrite old values.
     * These keys are defined in your DFP account.
     *
     * @param key Targeting parameter key.
     * @param value Targeting parameter value or array of values.
     */
    setTargeting(key: string, value: string | Array<string>): IPubAdsService;

    /**
     * Clears custom targeting parameters for a specific key or for all keys.
     * @param key Targeting parameter key. The key is optional; all targeting parameters will be cleared if it is unspecified.
     */
    clearTargeting(key?: string): IPubAdsService;

    /**
     * Sets values for AdSense attributes that apply to all ad slots under the publisher ads service.
     *
     * See AdSense Attributes for a list of available keys and values.
     * Calling this more than once for the same key will override previously set values for that key.
     * All values must be set before the first display call.
     *
     * @param key The name of the attribute.
     * @param value Attribute value.
     */
    set(key: string, value: string): IPubAdsService;

    /**
     * Fetches and displays new ads for specific or all slots on the page.
     *
     * Works only in asynchronous rendering mode. For proper behavior across all browsers, calling
     * refresh must be preceded by a call to display the ad slot. If the call to display is omitted,
     * refresh may behave unexpectedly. If desired, the disableInitialLoad method can be used to
     * stop display from fetching an ad.
     *
     * @param slots The slots to refresh. Array is optional; all slots will be refreshed if it is unspecified.
     * @param options Configuration options associated with this refresh call. changeCorrelator
     *        specifies whether or not a new correlator is to be generated for fetching ads. Our ad
     *        servers maintain this correlator value briefly (currently for 30 seconds, but subject to change),
     *        such that requests with the same correlator received close together will be considered
     *        a single page view. By default a new correlator is generated for every refresh.
     */
    refresh(slots?: IAdSlot[], options?: { changeCorrelator: boolean }): void;

    /**
     * Configures whether the page should request personalized or non-personalized ads. Personalized ads served by
     * default. This API will only have the desired effect starting on May 25, 2018!
     *
     * @param {0 | 1} nonPersonalizedAds - 0 for personalized ads, 1 for non-personalized ads.
     */
    setRequestNonPersonalizedAds(nonPersonalizedAds: 0 | 1): IPubAdsService;

    /**
     * Allows configuration of all privacy settings from a single API using a config object
     * @param privacySettings
     * @see https://developers.google.com/publisher-tag/reference#googletag.PubAdsService_setPrivacySettings
     */
    setPrivacySettings(privacySettings: IPrivacySettingsConfig): IPubAdsService;

    /**
     * Sets options for ignoring Google Ad Manager cookies on the current page.
     *
     * The cookie options to set. Possible values are:
     *   0: Enables Google Ad Manager cookies on ad requests on the page. This option is set by default.
     *   1: Ignores Google Ad Manager cookies on subsequent ad requests and prevents cookies from being created on the
     *      page. Note that cookies will not be ignored on certain pingbacks and that this option will disable features
     *      that rely on cookies, such as dynamic allocation.
     *
     * @param options
     * @see https://developers.google.com/publisher-tag/reference#googletag.PubAdsService_setCookieOptions
     */
    setCookieOptions(options: 0 | 1): IPubAdsService;
  }

  /**
   * ## Content Service
   *
   * The content service. This service is used to set the content of a slot manually.
   *
   * @see {@link https://developers.google.com/doubleclick-gpt/reference#googletagcontentservice}
   */
  export interface IContentService extends IService<IContentService> {
    /**
     * Fills a slot with the given content. If services are not yet enabled,
     * stores the content and fills it in when services are enabled.
     *
     * @example
     * ```javascript
     * var slot = googletag.defineSlot('/1234567/sports', [728, 90], 'div-1').
     * addService(googletag.content());
     * googletag.enableServices();
     *
     * var content = '<a href="www.mydestinationsite.com"><img src="www.mysite.com/img.png"></img></a>';
     * googletag.content().setContent(slot, content);
     * ```
     *
     * @param slot - The slot to be filled.
     * @param content - The HTML content for the slot.
     */
    setContent(slot: IAdSlot, content: string): void;
  }

  export namespace events {
    export interface IImpressionViewableEvent extends Event {
      serviceName: string;
      slot: IAdSlot;
    }

    export interface ISlotRequestedEvent extends Event {
      serviceName: string;
      slot: IAdSlot;
    }

    export interface ISlotResponseReceived extends Event {
      serviceName: string;
      slot: IAdSlot;
    }

    export interface ISlotOnloadEvent extends Event {
      serviceName: string;
      slot: IAdSlot;
    }

    export interface ISlotRenderEndedEvent extends Event {
      isEmpty: boolean;

      /**
       * Advertiser ID of the rendered ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/33559401#admin/companyDetail/id=<advertiserId>
       */
      advertiserId?: number;

      /**
       * Campaign ID (Order ID) of the rendered ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/33559401#delivery/OrderDetail/orderId=<campaignId>
       */
      campaignId?: number;

      /**
       * Line item ID of the rendered reservation ad. Value is null for empty slots, backfill ads or creatives rendered
       * by services other than pubads service.
       *
       * Viewable in ad manager: https://admanager.google.com/33559401#delivery/LineItemDetail/orderId=<campaignId>&lineItemId=<lineItemId>
       */
      lineItemId?: number;

      /**
       * Creative ID of the rendered reservation ad. Value is null for empty slots, backfill ads or creatives rendered by services other than pubads service.
       */
      creativeId?: number;

      /**
       * Creative ID of the rendered reservation or backfill ad. Value is null if the ad is not a reservation or line
       * item backfill or a creative rendered by services other than pubads service.
       */
      sourceAgnosticLineItemId?: number;
      serviceName: string;
      size: Size;
      slot: IAdSlot;
    }

    export interface ISlotVisibilityChangedEvent extends Event {
      inViewPercentage: number;
      serviceName: string;
      slot: IAdSlot;
    }
  }

  /**
   * interface for googletag
   */
  export interface IGoogleTag {
    /**
     * Reference to the global command queue for asynchronous execution of GPT-related calls.
     *
     * The googletag.cmd variable is initialized to an empty JavaScript array by the GPT tag syntax
     * on the page, and cmd.push is the standard Array.push method that adds an element to the end
     * of the array. When the GPT JavaScript is loaded, it looks through the array and executes all
     * the functions in order. The script then replaces cmd with a googletag.CommandArray object
     * whose push method is defined to execute the function argument passed to it.
     *
     * This mechanism allows GPT to reduce perceived latency by fetching the JavaScript asynchronously
     * while allowing the browser to continue rendering the page.
     */
    cmd: {
      push(callback: Function): void;
    };

    /**
     * Flag indicating that Pubads service is enabled, loaded and fully operational. This property will be simply
     * undefined until googletag.enableServices() is called and Pubads service is loaded and initialized.
     */
    pubadsReady: boolean | undefined;

    enums: {
      /**
       * @see https://developers.google.com/publisher-tag/reference#googletag.enums.OutOfPageFormat
       */
      OutOfPageFormat: {
        TOP_ANCHOR: enums.OutOfPageFormat.TOP_ANCHOR;
        BOTTOM_ANCHOR: enums.OutOfPageFormat.BOTTOM_ANCHOR;
        REWARDED: enums.OutOfPageFormat.REWARDED;
        INTERSTITIAL: enums.OutOfPageFormat.INTERSTITIAL;
      };
    };

    /**
     * @returns a reference to the pubads service.
     */
    pubads(): IPubAdsService;

    /**
     * @return a reference to the content service.
     */
    content(): IContentService;

    /**
     * Constructs an ad slot with a given ad unit path and size and associates it with the ID of a div element
     * on the page that will contain the ad.
     *
     * @param adUnitPath - Full path of the ad unit with the network code and unit code.
     * @param size - Width and height of the added slot. This is the size that is used
     *        in the ad request if no responsive size mapping is provided or the size of
     *        the viewport is smaller than the smallest size provided in the mapping.
     * @param slotId ID of the div that will contain this ad unit.
     * @return the defined slot or `null` if the slot already has been defined
     */
    defineSlot(adUnitPath: string, size: Size[], slotId: string): IAdSlot | null;

    /**
     * Destroys the given slots, removes all related objects and references of given slots from GPT.
     * This API does not support passback slots and companion slots.
     * Calling this API clears the ad and removes the slot object from the internal state maintained by GPT.
     * Calling any more functions on that slot object will result in undefined behaviour.
     * Note the browser may still not free the memory associated with that slot
     * if a reference to it is maintained by the publisher page.
     * Calling this API makes the div associated with that slot available for reuse.
     *
     * @param opt_slots - The array of slots to destroy. Array is optional;
     *                    all slots will be destroyed if it is unspecified!
     */
    destroySlots(opt_slots?: IAdSlot[]): void;

    /**
     * Constructs an out-of-page (interstitial) ad slot with the given ad unit path.
     * `slotId` is the ID of the div element that will contain the ad.
     *
     * @param adUnitPath - Full path of the ad unit with the network code and ad unit code.
     * @param slotIdOrFormat - ID of the div that will contain this ad unit or an out of page format
     * @return the defined slot or `null` if the slot already has been defined
     */
    defineOutOfPageSlot(
      adUnitPath: string,
      slotIdOrFormat: string | enums.OutOfPageFormat
    ): IAdSlot | null;

    /**
     * Enables all GPT services that have been defined for ad slots on the page.
     */
    enableServices(): void;

    /**
     * Instructs the slot services to render the slot. Each ad slot should only be displayed once per page.
     * All slots must be defined and have a service associated with them before being displayed.
     * The display call must not happen until the element is present in the DOM. The usual way
     * to achieve that is to place it within a script block within the div element named in the method call.
     *
     * If the single request architecture (SRA) is being used, all unfetched ad slots at the moment display is
     * called will be fetched in a single instance of googletag.display(). To force an ad slot not to display,
     * the entire div must be removed.
     *
     * @param id
     */
    display(id: string | Element | IAdSlot): void;
  }

  export namespace enums {
    /**
     * @see https://developers.google.com/publisher-tag/reference#googletag.enums.OutOfPageFormat
     */
    export enum OutOfPageFormat {
      TOP_ANCHOR = 2,
      BOTTOM_ANCHOR = 3,
      REWARDED = 4,
      INTERSTITIAL = 5
    }
  }

  /**
   * interface for Google DFP AdSlot.
   * The API reference calls this `Slot`
   */
  export interface IAdSlot {
    /**
     * Sets whether the slot div should be hidden when there is no ad in the slot.
     * This overrides the service-level settings.
     *
     * @param doCollapse - Whether to collapse the slot if no ad is returned.
     * @param collapseBeforeAdFetch - Whether to collapse the slot even before an ad is fetched.
     *                                Ignored if collapse is not true.
     */
    setCollapseEmptyDiv(doCollapse: boolean, collapseBeforeAdFetch?: boolean): void;

    /**
     * Adds a service to this slot.
     * @param service
     */
    addService(service: googletag.IService<any>): void;

    /**
     * Returns the id of the slot element provided when the slot was defined.
     */
    getSlotElementId(): string;

    /**
     * Returns the full path of the ad unit, with the network code and ad unit path.
     * @returns {string}
     */
    getAdUnitPath(): string;

    /**
     * Sets a custom targeting parameter for this slot. Calling this method multiple times for the same key will
     * overwrite old values. Values set here will overwrite targeting parameters set on service level.
     *
     * These keys are defined in your DFP account.
     *
     * @param {string} key The targeting key to look for.
     * @param {string | string[]} value
     */
    setTargeting(key: string, value: string | string[]): IAdSlot;

    /**
     * Returns a specific custom targeting parameter set on this slot. Service-level targeting parameters are not included.
     *
     * @param {string} key
     * @returns {string[]} The values associated with this key, or an empty array if there is no such key.
     */
    getTargeting(key: string): string[];

    /**
     * Returns the list of all custom targeting keys set on this slot. Service-level targeting keys are not included.
     * @returns {string[]} Array of targeting keys. Ordering is undefined.
     */
    getTargetingKeys(): string[];

    /**
     * Clears specific or all custom slot-level targeting parameters for this slot.
     * @param {string} key - optional key, if unspecified all slot targetings will be cleared
     * @see https://developers.google.com/doubleclick-gpt/reference#googletag.Slot_clearTargeting
     */
    clearTargeting(key?: string): void;
  }

  /**
   * Configuration object for privacy settings.
   * @see https://developers.google.com/publisher-tag/reference#googletag.PrivacySettingsConfig
   */
  export interface IPrivacySettingsConfig {
    /**
     * childDirectedTreatment configuration indicates whether the page should be treated as child-directed.
     * Set to null to clear the configuration.
     */
    readonly childDirectedTreatment?: boolean;

    /**
     * limitedAds configuration enables serving to run in limited ads mode to aid in publisher regulatory compliance needs.
     *
     * When enabled, GPT should also be requested from the limited ads URL.
     *
     * Standard: https://securepubads.g.doubleclick.net/tag/js/gpt.js
     * Limited Ads: https://pagead2.googlesyndication.com/tag/js/gpt.js
     *
     * @see https://developers.google.com/publisher-tag/guides/general-best-practices
     */
    readonly limitedAds?: boolean;

    /**
     * restrictDataProcessing configuration enables serving to run in restricted processing mode to aid in publisher
     * regulatory compliance needs.
     */
    readonly restrictDataProcessing?: boolean;

    /**
     * underAgeOfConsent configuration indicates whether to mark ad requests as coming from users under the age of consent. Set to null to clear the configuration.
     */
    readonly underAgeOfConsent?: boolean;
  }
}
