import { IModule, ModuleType } from '../../../types/module';
import { IAssetLoaderService } from '../../../util/assetLoaderService';
import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from '../../../types/moliConfig';
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
