import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import Blocklist = modules.blocklist.Blocklist;
export declare class BlocklistedUrls implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private blocklistConfig;
    private readonly window;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(assetLoaderService: IAssetLoaderService): InitStep[];
    isBlocklisted: (blocklist: Blocklist, href: string, log: MoliRuntime.MoliLogger) => boolean;
    private getBlocklist;
    private loadConfigWithRetry;
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
}
