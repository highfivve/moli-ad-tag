import { PrepareRequestAdsStep, ConfigureStep, InitStep } from '../../adPipeline';
import { IModule, ModuleType } from '../../../types/module';
import { modules } from '../../../types/moliConfig';
export declare class Cleanup implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private cleanupConfig;
    configure(modulesConfig?: modules.ModulesConfig): void;
    config(): Object | null;
    initSteps(): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    private cleanUp;
    private hasBidderWonLastAuction;
}
