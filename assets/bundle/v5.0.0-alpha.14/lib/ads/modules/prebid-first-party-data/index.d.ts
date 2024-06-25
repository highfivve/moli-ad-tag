import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from 'ad-tag/ads/adPipeline';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
export declare class PrebidFirstPartyDataModule implements IModule {
    readonly description = "Module for passing first party data to prebid auctions";
    readonly moduleType: ModuleType;
    readonly name = "prebid-first-party-data";
    private moduleConfig;
    private _configureSteps;
    config(): modules.prebid_first_party_data.PrebidFirstPartyDataModuleConfig | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    private static setPrebidFpdConfig;
    private static extractKeyValueArray;
}
