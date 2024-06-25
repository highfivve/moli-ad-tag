import { IModule, ModuleType } from 'ad-tag/types/module';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
export declare class Pubstack implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private pubstackConfig;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
}
