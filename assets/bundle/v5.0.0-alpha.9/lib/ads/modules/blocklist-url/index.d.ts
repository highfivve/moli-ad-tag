import { IModule, ModuleType } from '../../../types/module';
import { MoliRuntime } from '../../../types/moliRuntime';
import { IAssetLoaderService } from '../../../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { modules } from '../../../types/moliConfig';
export type BlocklistEntry = {
    readonly pattern: string;
    readonly matchType: 'regex' | 'contains' | 'exact';
};
export type Blocklist = {
    readonly urls: BlocklistEntry[];
};
export type StaticBlocklistProvider = {
    readonly provider: 'static';
    readonly blocklist: Blocklist;
};
export type DynamicBlocklistProvider = {
    readonly provider: 'dynamic';
    readonly endpoint: string;
};
export type BlocklistProvider = StaticBlocklistProvider | DynamicBlocklistProvider;
export type BlocklistUrlsBlockingConfig = {
    readonly mode: 'block';
    readonly blocklist: BlocklistProvider;
};
export type BlocklistUrlsKeyValueConfig = {
    readonly mode: 'key-value';
    readonly blocklist: BlocklistProvider;
    readonly key: string;
    readonly isBlocklistedValue?: string;
};
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
