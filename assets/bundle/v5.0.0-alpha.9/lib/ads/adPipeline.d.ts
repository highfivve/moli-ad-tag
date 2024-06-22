import { MoliRuntime } from '../types/moliRuntime';
import SlotDefinition = MoliRuntime.SlotDefinition;
import { LabelConfigService } from './labelConfigService';
import { apstag } from '../types/apstag';
import { tcfapi } from '../types/tcfapi';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { AdUnitPathVariables } from './adUnitPath';
import { GlobalAuctionContext } from './globalAuctionContext';
import { AdSlot, bucket, Environment, MoliConfig } from '../types/moliConfig';
import MoliRuntimeConfig = MoliRuntime.MoliRuntimeConfig;
export type AdPipelineContext = {
    readonly requestId: number;
    readonly requestAdsCalls: number;
    readonly logger: MoliRuntime.MoliLogger;
    readonly env: Environment;
    readonly config: MoliConfig;
    readonly runtimeConfig: MoliRuntimeConfig;
    readonly labelConfigService: LabelConfigService;
    readonly window: Window & apstag.WindowA9 & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow & tcfapi.TCFApiWindow & MoliRuntime.MoliWindow;
    readonly tcData: tcfapi.responses.TCData;
    readonly bucket?: bucket.BucketConfig | null;
    readonly adUnitPathVariables: AdUnitPathVariables;
    readonly auction: GlobalAuctionContext;
};
export type InitStep = (context: AdPipelineContext) => Promise<void>;
export type ConfigureStep = (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>;
export type DefineSlotsStep = (context: AdPipelineContext, slots: AdSlot[]) => Promise<SlotDefinition[]>;
export type PrepareRequestAdsStep = {
    (context: AdPipelineContext, slots: SlotDefinition[]): Promise<unknown>;
    readonly priority: number;
};
export type RequestBidsStep = (context: AdPipelineContext, slots: SlotDefinition[]) => Promise<void>;
export type RequestAdsStep = (context: AdPipelineContext, slots: SlotDefinition[]) => Promise<void>;
export interface IAdPipelineConfiguration {
    readonly init: InitStep[];
    readonly configure: ConfigureStep[];
    readonly defineSlots: DefineSlotsStep;
    readonly prepareRequestAds: PrepareRequestAdsStep[];
    readonly requestBids: RequestBidsStep[];
    readonly requestAds: RequestAdsStep;
}
export declare const HIGH_PRIORITY = 100;
export declare const LOW_PRIORITY = 10;
export declare const mkInitStep: (name: string, fn: (context: AdPipelineContext) => Promise<void>) => InitStep;
export declare const mkConfigureStep: (name: string, fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>) => ConfigureStep;
export declare const mkConfigureStepOncePerRequestAdsCycle: (name: string, fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>) => ConfigureStep;
export declare const mkConfigureStepOnce: (name: string, fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>) => ConfigureStep;
export declare const mkPrepareRequestAdsStep: (name: string, priority: number, fn: (context: AdPipelineContext, slots: SlotDefinition[]) => Promise<void>) => PrepareRequestAdsStep;
export declare const mkRequestBidsStep: (name: string, fn: (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => Promise<void>) => RequestBidsStep;
export declare class AdPipeline {
    readonly config: IAdPipelineConfiguration;
    private readonly logger;
    private readonly window;
    private readonly auction;
    private init;
    private tcData;
    private requestId;
    constructor(config: IAdPipelineConfiguration, logger: MoliRuntime.MoliLogger, window: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow & MoliRuntime.MoliWindow, auction: GlobalAuctionContext);
    run(slots: AdSlot[], config: MoliConfig, runtimeConfig: MoliRuntimeConfig, requestAdsCalls: number, bucketName?: string): Promise<void>;
    getAuction(): GlobalAuctionContext | undefined;
    private runPrepareRequestAds;
    private logStage;
}
