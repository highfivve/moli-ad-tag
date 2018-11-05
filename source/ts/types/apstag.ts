export namespace apstag {

  export interface IApsTag {

    /**
     * Command queue on the 'apstag' window object
     */
    _Q: Array<[string, IArguments]>;

    /**
     * Set the configuration for apstag operation.
     * This method should only be called once and must be called prior to calling apstag.fetchBids().
     */
    init(config: IInitConfig): void;

    /**
     * This method requests bids asynchronously then executes the provided callback function. The callback is executed
     * when the network request for bids is returned to the page, or when the timeout is reached.
     *
     * To request bids, call apstag.fetchBids with a bidConfig argument that includes what slots to run auctions for and
     * the function to execute when the bids are returned to the page.
     *
     * Slot IDs must match the div IDs that contains the ad slots, and this ID is echoed back in the bid response in the
     * SlotID property to associate that bid with the slot.
     *
     * NOTE: The slot IDs and sizes on your site may vary by page/template
     */
    fetchBids(bidConfig: IBidConfig, callback: (bids: Object[]) => void): void;

    /**
     * If you have set googletag as the config.adServer in apstag.init(), this method will set the bid targeting on the
     * googletag slots.
     */
    setDisplayBids(): void;

    /**
     * Returns an array of targeting keys associated with the bid objects
     */
    targetingKeys(): void;
  }

  export interface IInitConfig {
    /**
     * The unique ID associated with your account. This will be provided by your account manager.
     */
    pubID: string;

    /**
     * Declare the ad server that will be receiving key value targeting to activate display line items.
     */
    adServer: 'googletag' | 'appnexus';

    /**
     * Settings for the General Data Protection Regulation (GDPR) (EU)
     * This section provides information on how to provide information on user consent
     * to your bidders in the Unified Ad Marketplace and Transparent Ad Marketplace,
     * as defined by the IAB GDPR Transparency and Consent Framework.
     * If you wish to send the IAB GDPR Consent Framework gdpr flag and consent string
     * to your bidders, you must have an IAB-compliant CMP
     * (see the IAB specification here) loaded before calling apstag.fetchBids.
     * By default, the library will check for the existence of a CMP and will query it
     * with a timeout of 50ms. This timeout can be controlled via the apstag.init
     */
    gdpr?: {
      /**
       * how long, in milliseconds, to wait for a CMP to respond. Note:
       * this timeout occurs BEFORE the timeout for the auction is started. Default: 50ms
       */
      cmpTimeout?: number;
    };
  }

  export interface IBidConfig {
    /**
     * An array of slot objects, containing display and/or video slots:
     */
    slots: ISlot[];

    /**
     * How many milliseconds to wait for apstag.fetchBids(bidConfig, callback) response before executing the callback.
     * Supersedes the config.bidTimeout value set in apstag.init().
     */
    timeout?: number;
  }

  export interface ISlot {
    /**
     * The div ID the slot will render into
     */
    slotID: string;

    /**
     * The name of the slot requested; this is used for reporting and is also the tag_id in OpenRTB sent to bidding
     * partners. If your ad server is DFP, please use the shortest meaningful ad unit path, including the network ID.
     *
     * Eg. /1234/mysite/sports/atf_multi_flex
     */
    slotName: string;

    /**
     * The sizes to consider in the auction for this slot
     */
    sizes: [number, number][];
  }
}


declare global {

  /**
   * Add the ApsTag (Amazon A9) API to the global Window instance
   */
  interface Window {

    /**
     * global apstag object
     */
    apstag: apstag.IApsTag;
  }
}