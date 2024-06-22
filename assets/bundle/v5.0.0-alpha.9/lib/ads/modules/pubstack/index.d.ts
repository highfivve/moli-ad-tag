import { IModule, ModuleType } from '../../../types/module';
import { IAssetLoaderService } from '../../../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from '../../../types/moliConfig';
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
