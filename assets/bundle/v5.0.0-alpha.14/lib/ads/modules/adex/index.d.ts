import { IModule, ModuleType } from 'ad-tag/types/module';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import AdexConfig = modules.adex.AdexConfig;
import { tcfapi } from 'ad-tag/types/tcfapi';
import AdexKeyValues = modules.adex.AdexKeyValues;
export interface ITheAdexWindow extends Window {
    _adexc?: IUserTrackPluginKeyValueConfiguration[];
}
interface IUserTrackPluginKeyValueConfiguration {
    [0]: string;
    [1]: 'ut';
    [2]: '_kv';
    [3]: {
        [0]: AdexKeyValues;
        [1]: 0 | 1;
    };
}
export declare class AdexModule implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private adexConfig;
    private readonly window;
    private isLoaded;
    config(): modules.adex.AdexConfig | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    configureSteps(): ConfigureStep[];
    track(context: AdPipelineContext, assetLoaderService: IAssetLoaderService, adexConfig: AdexConfig): Promise<void>;
    hasRequiredConsent: (tcData: tcfapi.responses.TCData) => boolean;
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    private getAdexKeyValues;
    private configureAdexC;
}
export {};
