import { IModule, ModuleType } from '../../../types/module';
import { googletag } from '../../../types/googletag';
import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from '../../../types/moliConfig';
export declare class AdReload implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private moduleConfig;
    private adVisibilityService?;
    private readonly refreshIntervalMs;
    private readonly reloadKeyValue;
    private initialized;
    config(): modules.adreload.AdReloadModuleConfig | null;
    isInitialized(): boolean;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    initialize: (context: AdPipelineContext, config: modules.adreload.AdReloadModuleConfig, slotsToMonitor: string[], reloadAdSlotCallback: (slot: googletag.IAdSlot) => void) => void;
    private setupAdVisibilityService;
    private setupSlotRenderListener;
    private reloadAdSlot;
    private maybeOptimizeSlotForCls;
    private logTrackingDisallowedReason;
}
