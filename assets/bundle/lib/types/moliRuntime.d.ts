import { googletag } from './googletag';
import { prebidjs } from './prebidjs';
import { IModule, ModuleMeta } from './module';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../ads/adPipeline';
import { AdSlot, AdUnitPathVariables, behaviour, Environment, GoogleAdManagerKeyValueMap, GoogleAdManagerSlotSize, MoliConfig, ResolveAdUnitPathOptions, Targeting } from './moliConfig';
export declare namespace MoliRuntime {
    type MoliCommand = (moli: MoliTag) => void;
    interface MoliTag {
        que: {
            push(cmd: MoliCommand): void;
        };
        version: string;
        setTargeting(key: string, value: string | string[]): void;
        addLabel(label: String): void;
        setAdUnitPathVariables(variables: AdUnitPathVariables): void;
        resolveAdUnitPath(adUnitPath: string, options?: ResolveAdUnitPathOptions): string;
        setLogger(logger: MoliLogger): void;
        beforeRequestAds(callback: (config: MoliConfig) => void): void;
        afterRequestAds(callback: (state: state.AfterRequestAdsStates) => void): void;
        registerModule(module: IModule): void;
        configure(config: MoliConfig): void;
        requestAds(): Promise<state.IConfigurable | state.ISinglePageApp | state.IFinished | state.IError>;
        refreshAdSlot(domId: string | string[], options?: RefreshAdSlotsOptions): Promise<'queued' | 'refreshed'>;
        refreshInfiniteAdSlot(domId: string, idOfConfiguredSlot: string): Promise<'queued' | 'refreshed'>;
        refreshBucket(bucket: string): Promise<'queued' | 'refreshed'>;
        refreshBucket(bucket: string): Promise<'queued' | 'refreshed'>;
        getConfig(): Readonly<MoliConfig> | null;
        getRuntimeConfig(): Readonly<MoliRuntimeConfig>;
        getPageTargeting(): Readonly<Targeting>;
        getState(): state.States;
        getModuleMeta(): ReadonlyArray<ModuleMeta>;
        openConsole(path?: string): void;
        getAssetLoaderService(): IAssetLoaderService;
    }
    interface MoliRuntimeConfig {
        environment?: Environment;
        readonly adPipelineConfig: AdPipelineConfig;
        readonly keyValues: GoogleAdManagerKeyValueMap;
        readonly labels: string[];
        adUnitPathVariables: AdUnitPathVariables;
        readonly refreshSlots: string[];
        readonly refreshInfiniteSlots: IRefreshInfiniteSlot[];
        readonly hooks: state.IHooks;
        logger?: MoliLogger;
    }
    interface RefreshAdSlotsOptions {
        readonly loaded?: Exclude<behaviour.ISlotLoading['loaded'], 'infinite'>;
        readonly sizesOverride?: GoogleAdManagerSlotSize[];
    }
    type IRefreshInfiniteSlot = {
        readonly artificialDomId: string;
        readonly idOfConfiguredSlot: string;
    };
    namespace state {
        export type States = 'configurable' | 'configured' | 'spa-finished' | 'spa-requestAds' | 'requestAds' | 'finished' | 'error';
        export interface IState {
            readonly state: States;
        }
        interface WithConfiguration {
            readonly config: MoliConfig;
        }
        interface WithRuntimeConfiguration {
            readonly runtimeConfig: MoliRuntimeConfig;
        }
        interface WithModulesConfigurable {
            readonly modules: IModule[];
        }
        interface WithModules {
            readonly modules: ReadonlyArray<IModule>;
        }
        export interface IConfigurable extends IState, WithRuntimeConfiguration, WithModulesConfigurable {
            readonly state: 'configurable';
            readonly config?: never;
            initialize: boolean;
        }
        export interface IConfigured extends IState, WithRuntimeConfiguration, WithConfiguration, WithModulesConfigurable {
            readonly state: 'configured';
        }
        export interface IRequestAds extends IState, WithRuntimeConfiguration, WithConfiguration, WithModules {
            readonly state: 'requestAds';
        }
        export interface ISinglePageApp extends IState, WithRuntimeConfiguration, WithConfiguration, WithModules {
            readonly state: 'spa-finished' | 'spa-requestAds';
            readonly initialized: Promise<MoliConfig>;
            readonly href: string;
            readonly nextRuntimeConfig: MoliRuntimeConfig;
        }
        export interface IFinished extends IState, WithRuntimeConfiguration, WithConfiguration, WithModules {
            readonly state: 'finished';
        }
        export interface IError extends IState, WithRuntimeConfiguration, WithModules, WithConfiguration {
            readonly state: 'error';
            readonly error: any;
        }
        export type IStateMachine = IConfigurable | IConfigured | ISinglePageApp | IRequestAds | IFinished | IError;
        export type AfterRequestAdsStates = Extract<state.States, 'finished' | 'error' | 'spa-finished'>;
        export type BeforeRequestAdsHook = (config: MoliConfig, runtimeConfig: MoliRuntimeConfig) => void;
        export interface IHooks {
            readonly beforeRequestAds: BeforeRequestAdsHook[];
            readonly afterRequestAds: Array<(state: AfterRequestAdsStates) => void>;
        }
        export {};
    }
    type FilterSupportedSizes = (givenSizes: GoogleAdManagerSlotSize[]) => GoogleAdManagerSlotSize[];
    interface SlotDefinition<S extends AdSlot = AdSlot> {
        readonly moliSlot: S;
        readonly filterSupportedSizes: FilterSupportedSizes;
        readonly adSlot: googletag.IAdSlot;
        priceRule?: yield_optimization.PriceRule;
    }
    namespace headerbidding {
        interface PrebidAdSlotContext {
            readonly keyValues: GoogleAdManagerKeyValueMap;
            readonly floorPrice: number | undefined;
            readonly priceRule?: yield_optimization.PriceRule | undefined;
            readonly labels: string[];
            readonly isMobile: boolean;
        }
        type PrebidListenerProvider = PrebidListener | ((context: PrebidListenerContext) => PrebidListener);
        interface PrebidListener {
            readonly preSetTargetingForGPTAsync?: (bidResponses: prebidjs.IBidResponsesMap, timedOut: boolean, slotDefinitions: SlotDefinition<AdSlot>[]) => void;
        }
        interface PrebidListenerContext {
            readonly keyValues: GoogleAdManagerKeyValueMap;
        }
    }
    interface AdPipelineConfig {
        readonly initSteps: InitStep[];
        readonly configureSteps: ConfigureStep[];
        readonly prepareRequestAdsSteps: PrepareRequestAdsStep[];
    }
    namespace yield_optimization {
        interface PriceRule {
            readonly priceRuleId: number;
            readonly model?: 'static' | 'ml' | 'fixed';
            readonly floorprice: number;
            readonly main: boolean;
        }
    }
    interface MoliLogger {
        debug(message?: any, ...optionalParams: any[]): void;
        info(message?: any, ...optionalParams: any[]): void;
        warn(message?: any, ...optionalParams: any[]): void;
        error(message?: any, ...optionalParams: any[]): void;
    }
    type MoliWindow = Window & {
        moli: MoliRuntime.MoliTag;
    };
}
