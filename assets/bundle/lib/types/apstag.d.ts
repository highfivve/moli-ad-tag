import { SupplyChainObject } from './supplyChainObject';
export declare namespace apstag {
    export interface IApsTag {
        _Q: Array<[string, IArguments]>;
        init(config: IInitConfig): void;
        fetchBids(bidConfig: IBidConfig, callback: (bids: Object[]) => void): void;
        setDisplayBids(): void;
        targetingKeys(): void;
        rpa(tokenConfig: ITokenConfig, callback?: () => void): any;
        upa(tokenConfig: ITokenConfig, callback?: () => void): any;
        dpa(callback?: () => void): any;
    }
    export interface IInitConfig {
        pubID: string;
        adServer: 'googletag' | 'appnexus';
        videoAdServer?: string;
        bidTimeout?: number;
        gdpr?: {
            cmpTimeout?: number;
        };
        params?: {
            [key: string]: string | string[];
        };
        schain: SupplyChainObject.ISupplyChainObject;
    }
    export interface ITokenConfig {
        readonly gdpr?: {
            readonly enabled: true;
            readonly consent: string;
        } | {
            readonly enabled: false;
        };
        readonly hashedRecords: HashedRecord[];
        readonly optOut?: boolean;
        readonly duration?: number;
    }
    type HashedRecord = {
        readonly type: 'email';
        readonly record: string;
    };
    export interface IBidConfig {
        slots: ISlot[];
        bidTimeout?: number;
    }
    export type ISlot = IDisplaySlot | IVideoSlot;
    export type Currency = 'USD' | 'EUR';
    export interface IFloorPrice {
        readonly value: number;
        readonly currency: Currency;
    }
    export interface IDisplaySlot {
        readonly slotID: string;
        readonly slotName: string;
        readonly sizes: [number, number][];
        readonly floor?: IFloorPrice;
    }
    export interface IVideoSlot {
        slotID: string;
        mediaType: 'video';
    }
    export type WindowA9 = {
        apstag: apstag.IApsTag;
    };
    export {};
}
declare global {
    interface Window {
        apstag: apstag.IApsTag;
    }
}
