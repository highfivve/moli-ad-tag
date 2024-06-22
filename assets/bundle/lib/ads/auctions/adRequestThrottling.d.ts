import { googletag } from '../../types/googletag';
import { auction } from '../../types/moliConfig';
export declare class AdRequestThrottling {
    private readonly config;
    private readonly _window;
    private slotsRequested;
    constructor(config: auction.AdRequestThrottlingConfig, _window: Window);
    onSlotRequested(event: googletag.events.ISlotRequestedEvent): void;
    isThrottled(slotId: string): boolean;
}
