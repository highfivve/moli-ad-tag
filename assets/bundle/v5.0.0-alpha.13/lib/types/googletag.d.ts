export declare namespace googletag {
    interface IGoogleTagWindow {
        googletag: googletag.IGoogleTag;
    }
    type Size = [number, number] | string;
    interface IService<T extends IService<any>> {
        addEventListener(eventType: 'slotRenderEnded', listener: (event: events.ISlotRenderEndedEvent) => void): T;
        addEventListener(eventType: 'impressionViewable', listener: (event: events.IImpressionViewableEvent) => void): T;
        addEventListener(eventType: 'slotOnload', listener: (event: events.ISlotOnloadEvent) => void): T;
        addEventListener(eventType: 'slotRequested', listener: (event: events.ISlotRequestedEvent) => void): T;
        addEventListener(eventType: 'slotResponseReceived', listener: (event: events.ISlotResponseReceived) => void): T;
        addEventListener(eventType: 'slotVisibilityChanged', listener: (event: events.ISlotVisibilityChangedEvent) => void): T;
        removeEventListener(eventType: 'slotRenderEnded', listener: (event: events.ISlotRenderEndedEvent) => void): boolean;
        removeEventListener(eventType: 'impressionViewable', listener: (event: events.IImpressionViewableEvent) => void): boolean;
        removeEventListener(eventType: 'slotOnload', listener: (event: events.ISlotOnloadEvent) => void): boolean;
        removeEventListener(eventType: 'slotRequested', listener: (event: events.ISlotRequestedEvent) => void): boolean;
        removeEventListener(eventType: 'slotResponseReceived', listener: (event: events.ISlotResponseReceived) => void): boolean;
        removeEventListener(eventType: 'slotVisibilityChanged', listener: (event: events.ISlotVisibilityChangedEvent) => void): boolean;
        getSlots(): Array<IAdSlot>;
    }
    interface IPubAdsService extends IService<IPubAdsService> {
        enableSingleRequest(): boolean;
        enableAsyncRendering(): boolean;
        disableInitialLoad(): void;
        setTargeting(key: string, value: string | Array<string>): IPubAdsService;
        clearTargeting(key?: string): IPubAdsService;
        set(key: string, value: string): IPubAdsService;
        refresh(slots?: IAdSlot[], options?: {
            changeCorrelator: boolean;
        }): void;
        setRequestNonPersonalizedAds(nonPersonalizedAds: 0 | 1): IPubAdsService;
        setPrivacySettings(privacySettings: IPrivacySettingsConfig): IPubAdsService;
        setCookieOptions(options: 0 | 1): IPubAdsService;
    }
    namespace events {
        interface IImpressionViewableEvent extends Event {
            serviceName: string;
            slot: IAdSlot;
        }
        interface ISlotRequestedEvent extends Event {
            serviceName: string;
            slot: IAdSlot;
        }
        interface ISlotResponseReceived extends Event {
            serviceName: string;
            slot: IAdSlot;
        }
        interface ISlotOnloadEvent extends Event {
            serviceName: string;
            slot: IAdSlot;
        }
        interface ISlotRenderEndedEvent extends Event {
            isEmpty: boolean;
            advertiserId?: number;
            campaignId?: number;
            lineItemId?: number;
            creativeId?: number;
            sourceAgnosticLineItemId?: number;
            yieldGroupIds: null | number[];
            serviceName: string;
            size: Size;
            slot: IAdSlot;
        }
        interface ISlotVisibilityChangedEvent extends Event {
            inViewPercentage: number;
            serviceName: string;
            slot: IAdSlot;
        }
    }
    interface IGoogleTag {
        cmd: {
            push(callback: Function): void;
        };
        pubadsReady: boolean | undefined;
        enums: {
            OutOfPageFormat: {
                TOP_ANCHOR: enums.OutOfPageFormat.TOP_ANCHOR;
                BOTTOM_ANCHOR: enums.OutOfPageFormat.BOTTOM_ANCHOR;
                REWARDED: enums.OutOfPageFormat.REWARDED;
                INTERSTITIAL: enums.OutOfPageFormat.INTERSTITIAL;
            };
        };
        pubads(): IPubAdsService;
        defineSlot(adUnitPath: string, size: Size[], slotId: string): IAdSlot | null;
        destroySlots(opt_slots?: IAdSlot[]): void;
        defineOutOfPageSlot(adUnitPath: string, slotIdOrFormat: string | enums.OutOfPageFormat): IAdSlot | null;
        enableServices(): void;
        display(id: string | Element | IAdSlot): void;
    }
    namespace enums {
        enum OutOfPageFormat {
            TOP_ANCHOR = 2,
            BOTTOM_ANCHOR = 3,
            REWARDED = 4,
            INTERSTITIAL = 5
        }
    }
    interface IAdSlot {
        setCollapseEmptyDiv(doCollapse: boolean, collapseBeforeAdFetch?: boolean): void;
        addService(service: googletag.IService<any>): void;
        getSlotElementId(): string;
        getAdUnitPath(): string;
        setTargeting(key: string, value: string | string[]): IAdSlot;
        getTargeting(key: string): string[];
        getTargetingKeys(): string[];
        clearTargeting(key?: string): void;
        getResponseInformation(): null | IResponseInformation;
    }
    interface IResponseInformation {
        readonly advertiserId: null | number;
        readonly campaignId?: number;
        readonly lineItemId?: number;
        readonly creativeId?: number;
        readonly creativeTemplateId: null | number;
    }
    interface IPrivacySettingsConfig {
        readonly childDirectedTreatment?: boolean;
        readonly limitedAds?: boolean;
        readonly restrictDataProcessing?: boolean;
        readonly underAgeOfConsent?: boolean;
    }
}
