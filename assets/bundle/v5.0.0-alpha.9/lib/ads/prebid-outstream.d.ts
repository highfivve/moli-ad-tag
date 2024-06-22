import { prebidjs } from '../types/prebidjs';
export type OutStreamPlayerWindow = {
    outstreamPlayer?: (bid: PrebidOutstreamBid, elementId: string, config: PrebidOutstreamConfiguration) => void;
};
export type PrebidOutstreamConfiguration = Partial<{
    width: number;
    height: number;
    vastTimeout: number;
    maxAllowedVastTagRedirects: number;
    allowVpaid: boolean;
    autoPlay: boolean;
    preload: boolean;
    mute: boolean;
    adText: string;
}>;
export type PrebidOutstreamBid = Partial<{
    ad: string | null;
    vastXml: string;
    id: string;
    impid: string;
    price: number;
    adm: string;
    adomain: string[];
    cid: string;
    crid: string;
    ext: {
        dspid: number;
        advid: number;
    };
    renderer: {
        push: (func: () => void) => void;
    };
}>;
export declare const prebidOutstreamRenderer: (domId: string, config?: PrebidOutstreamConfiguration) => prebidjs.IRenderer;
export declare const renderPrebidOutstream: (bid: PrebidOutstreamBid, domId: string, config?: PrebidOutstreamConfiguration) => void;
