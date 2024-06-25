import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
export declare class BiddersDisabling {
    private readonly config;
    private readonly window;
    private participationInfo;
    private logger?;
    constructor(config: auction.BidderDisablingConfig, window: Window);
    isBidderDisabled(position: string, bidderCode: BidderCode): boolean;
    onAuctionEnd(auction: any): void;
    private deactivateBidderForTTL;
    private shouldDisableBidder;
    private disableBidder;
    private enableBidder;
}
