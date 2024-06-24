import { IModule, ModuleType } from 'ad-tag/types/module';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
export declare class Confiant implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private readonly gvlid;
    private confiantConfig;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    loadConfiant(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void>;
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
}
