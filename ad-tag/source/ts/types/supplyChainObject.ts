export namespace SupplyChainObject {
  export interface ISupplyChainObject {
    /**
     * Version of the supply chain specification in use, in the format of “major.minor”.
     * For example, for version 1.0 of the spec, use the string “1.0”.
     */
    readonly ver: '1.0';

    /**
     * Flag indicating whether the chain contains all nodes involved in the transaction leading back to the owner of
     * the site, app or other medium of the inventory, where 0 = no, 1 = yes.
     */
    readonly complete: 0 | 1;

    /**
     * Array of SupplyChainNode objects in the order of the chain. In a complete supply chain, the first node
     * represents the initial advertising system and seller ID involved in the transaction, i.e. the owner of the site,
     * app, or other medium. In an incomplete supply chain, it represents the first known node. The last node
     * represents the entity sending this bid request.
     */
    readonly nodes: ISupplyChainNode[];

    /**
     * Placeholder for advertising-system specific extensions to this object.
     */
    readonly ext?: any;
  }

  export interface ISupplyChainNode {
    /**
     * The canonical domain name of the SSP, Exchange, Header Wrapper, etc system that bidders connect to. This may
     * be the operational domain of the system, if that is different than the parent corporate domain, to facilitate
     * WHOIS and reverse IP lookups to establish clear ownership of the delegate system.
     *
     * This should be the same value as used to identify sellers in an ads.txt file if one exists.
     */
    readonly asi: string;

    /**
     * The identifier associated with the seller or reseller account within the advertising system.
     * This must contain the same value used in transactions (i.e. OpenRTB bid requests) in the field specified by
     * the SSP/exchange. Typically, in OpenRTB, this is publisher.id. For OpenDirect it is typically the publisher’s
     * organization ID.Should be limited to 64 characters in length.
     */
    readonly sid: string;

    /**
     * Indicates whether this node will be involved in the flow of payment for the inventory. When set to 1,
     * the advertising system in the asi field pays the seller in the sid field, who is responsible for paying the
     * previous node in the chain. When set to 0, this node is not involved in the flow of payment for the inventory.
     *
     * For version 1.0 of SupplyChain, this property should always be 1. It is explicitly required to be included as
     * it is expected that future versions of the specification will introduce non-payment handling nodes.
     * Implementers should ensure that they support this field and propagate it onwards when constructing SupplyChain
     * objects in bid requests sent to a downstream advertising system.
     */
    readonly hp: 0 | 1;

    /**
     * The OpenRTB RequestId of the request as issued by this seller.
     */
    readonly rid?: string;

    /**
     * The name of the company (the legal entity) that is paid for inventory transacted under the given seller_id.
     * This value is optional and should NOT be included if it exists in the advertising system’s sellers.json file.
     */
    readonly name?: string;

    /**
     * The business domain name of the entity represented by this node. This value is optional and should NOT
     * be included if it exists in the advertising system’s sellers.json file.
     */
    readonly domain?: string;

    /**
     * Placeholder for advertising-system specific extensions to this object.
     */
    readonly ext?: any;
  }
}
