import { IAssetLoaderService } from '../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../ads/adPipeline';
import { modules } from './moliConfig';
export type ModuleType = 'cmp' | 'reporting' | 'ad-fraud' | 'prebid' | 'ad-reload' | 'policy' | 'identity' | 'dmp' | 'yield' | 'creatives' | 'lazy-load';
export interface IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
}
export type ModuleMeta = Pick<IModule, 'name' | 'description' | 'moduleType'> & {
    config: Object | null;
};
