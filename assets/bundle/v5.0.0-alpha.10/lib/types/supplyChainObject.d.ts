export declare namespace SupplyChainObject {
    interface ISupplyChainObject {
        readonly ver: '1.0';
        readonly complete: 0 | 1;
        readonly nodes: ISupplyChainNode[];
        readonly ext?: any;
    }
    interface ISupplyChainNode {
        readonly asi: string;
        readonly sid: string;
        readonly hp: 0 | 1;
        readonly rid?: string;
        readonly name?: string;
        readonly domain?: string;
        readonly ext?: any;
    }
}
