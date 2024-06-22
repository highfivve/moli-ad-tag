import { MoliRuntime } from '../types/moliRuntime';
import { googletag } from '../types/googletag';
export declare class PassbackService {
    private readonly logger;
    private readonly window;
    private isInitialized;
    private readonly adSlots;
    private readonly passbackKeyValue;
    private readonly passbackOriginKeyValue;
    constructor(logger: MoliRuntime.MoliLogger, window: Window & googletag.IGoogleTagWindow);
    addAdSlot(adSlot: MoliRuntime.SlotDefinition): void;
    private initMessageListener;
    private parseMessageData;
    private findAdSlot;
}
