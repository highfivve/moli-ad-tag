import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { BiddersDisabling } from './auctions/biddersDisabling';
import { AdRequestThrottling } from './auctions/adRequestThrottling';
import { auction } from '../types/moliConfig';
export declare class GlobalAuctionContext {
    private readonly window;
    private readonly config;
    readonly biddersDisabling?: BiddersDisabling;
    readonly adRequestThrottling?: AdRequestThrottling;
    constructor(window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow, config?: auction.GlobalAuctionContextConfig);
    isSlotThrottled(slotId: string): boolean;
    private handleAuctionEndEvent;
}
