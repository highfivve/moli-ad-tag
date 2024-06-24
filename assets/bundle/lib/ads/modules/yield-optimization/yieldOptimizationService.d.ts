import { AdServer, AdUnitPathVariables, Device, modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { googletag } from 'ad-tag/types/googletag';
type PriceRule = MoliRuntime.yield_optimization.PriceRule & {
    readonly main?: boolean;
};
export declare class YieldOptimizationService {
    private readonly yieldConfig;
    private readonly emptyAdUnitPriceRulesResponse;
    private adUnitPricingRuleResponse;
    private isEnabled;
    private device;
    private adUnitPathVariables;
    constructor(yieldConfig: modules.yield_optimization.YieldOptimizationConfig);
    init(device: Device, adUnitPathVariables: AdUnitPathVariables, adUnitPaths: string[], fetch: typeof window.fetch, logger: MoliRuntime.MoliLogger): Promise<void>;
    getPriceRule(adUnitPath: string): Promise<PriceRule | undefined>;
    getBrowser(): Promise<string>;
    setTargeting(adSlot: googletag.IAdSlot, adServer: AdServer, logger: MoliRuntime.MoliLogger): Promise<PriceRule | undefined>;
    private loadConfigWithRetry;
    private isAdunitPricesRulesResponse;
    private isPriceRules;
    private validateRules;
}
export {};
