import { IAssetLoaderService } from '../util/assetLoaderService';
import { MoliRuntime } from '../types/moliRuntime';
import { AdPipeline, IAdPipelineConfiguration } from './adPipeline';
import { AdSlot, MoliConfig } from '../types/moliConfig';
import MoliRuntimeConfig = MoliRuntime.MoliRuntimeConfig;
export declare class AdService {
    private readonly assetService;
    private readonly window;
    private readonly adPipelineConfig?;
    private readonly logger;
    private requestAdsCalls;
    private adPipeline;
    private static getEnvironment;
    constructor(assetService: IAssetLoaderService, window: Window, adPipelineConfig?: IAdPipelineConfiguration | undefined);
    initialize: (config: Readonly<MoliConfig>, runtimeConfig: Readonly<MoliRuntime.MoliRuntimeConfig>) => Promise<Readonly<MoliConfig>>;
    requestAds: (config: Readonly<MoliConfig>, runtimeConfig: Readonly<MoliRuntimeConfig>) => Promise<AdSlot[]>;
    refreshAdSlots(domIds: string[], config: MoliConfig, runtimeConfig: MoliRuntimeConfig, options?: MoliRuntime.RefreshAdSlotsOptions): Promise<void>;
    refreshBucket(bucket: string, config: MoliConfig, runtimeConfig: MoliRuntimeConfig): Promise<void>;
    getAdPipeline: () => AdPipeline;
    setLogger: (logger: MoliRuntime.MoliLogger) => void;
    private isManualSlot;
    private isInfiniteSlot;
    private isBackfillSlot;
    private isSlotAvailable;
}
