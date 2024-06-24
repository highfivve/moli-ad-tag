import { YieldOptimizationService } from './yieldOptimizationService';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from 'ad-tag/ads/adPipeline';
export declare class YieldOptimization implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private yieldModuleConfig;
    private _initSteps;
    private _prepareRequestAdsSteps;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    yieldOptimizationInit: (yieldOptimizationService: YieldOptimizationService) => InitStep;
    yieldOptimizationPrepareRequestAds: (yieldOptimizationService: YieldOptimizationService) => PrepareRequestAdsStep;
}
