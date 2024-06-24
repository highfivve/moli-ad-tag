import { IModule, ModuleType } from '../../../types/module';
import { IAssetLoaderService } from '../../../util/assetLoaderService';
import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { AdexKeyValues, MappingDefinition } from './adex-mapping';
import { modules } from '../../../types/moliConfig';
import AdexConfig = modules.adex.AdexConfig;
import { tcfapi } from '../../../types/tcfapi';
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
export interface AdexAppConfig {
    readonly clientTypeKey: string;
    readonly advertiserIdKey: string;
    readonly adexMobileTagId?: string;
}
export interface AdexModuleConfig {
    readonly adexCustomerId: string;
    readonly adexTagId: string;
    readonly spaMode: boolean;
    readonly mappingDefinitions: Array<MappingDefinition>;
    readonly appConfig?: AdexAppConfig;
}
export declare class AdexModule implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private adexConfig;
    private readonly window;
    private isLoaded;
    config(): AdexModuleConfig | null;
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
