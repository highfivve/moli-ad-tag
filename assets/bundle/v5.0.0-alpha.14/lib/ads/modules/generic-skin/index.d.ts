import { prebidjs } from 'ad-tag/types/prebidjs';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { googletag } from 'ad-tag/types/googletag';
import { modules } from 'ad-tag/types/moliConfig';
export declare enum SkinConfigEffect {
    BlockSkinSlot = "BlockSkinSlot",
    BlockOtherSlots = "BlockOtherSlots",
    NoBlocking = "NoBlocking"
}
export declare class Skin implements IModule {
    readonly name: string;
    readonly description: string;
    readonly moduleType: ModuleType;
    private skinModuleConfig;
    private log?;
    private currentSkinAdReloadSetTimeoutId;
    config(): Object | null;
    configure(moduleConfig?: modules.ModulesConfig): void;
    initSteps(): InitStep[];
    configureSteps(): ConfigureStep[];
    prepareRequestAdsSteps(): PrepareRequestAdsStep[];
    getConfigEffect: (config: modules.skin.SkinConfig, auctionObject: prebidjs.event.AuctionObject, logger: MoliRuntime.MoliLogger, trackSkinCpmLow: modules.skin.SkinModuleConfig['trackSkinCpmLow']) => SkinConfigEffect;
    selectConfig: (moduleConfig: modules.skin.SkinModuleConfig, auctionObject: prebidjs.event.AuctionObject, logger: MoliRuntime.MoliLogger) => {
        skinConfig: modules.skin.SkinConfig;
        configEffect: SkinConfigEffect;
    } | undefined;
    destroyAdSlots: (slotDomIds: string[], _window: googletag.IGoogleTagWindow) => void;
    private runSkinConfigs;
    private hideAdSlot;
}
