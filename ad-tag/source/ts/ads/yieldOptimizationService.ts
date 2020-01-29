import { IAssetLoaderService } from '../util/assetLoaderService';
import { Moli } from '../types/moli';
import { googletag } from '../types/googletag';
import YieldOptimizationConfig = Moli.yield_optimization.YieldOptimizationConfig;
import AdUnitPriceRules = Moli.yield_optimization.AdUnitPriceRules;
import MoliLogger = Moli.MoliLogger;
import IAdSlot = googletag.IAdSlot;

/**
 * internal representation which adds a flag `main` indicating if the main traffic share price rule was selected
 */
type PriceRule = Moli.yield_optimization.PriceRule & { main?: boolean };
type AdUnitsPriceRuleSelection = {
  [adUnit: string]: PriceRule
};

export class YieldOptimizationService {

  private readonly adUnitPricingRules: Promise<AdUnitsPriceRuleSelection>;

  /**
   * Generates a number between [0-99]
   */
  private readonly trafficShare: () => number;

  /**
   *
   * @param config the yield optimization config
   * @param assetLoaderService required to load dynamic yield configurations
   * @param log logging
   * @param randomTrafficShare must generate a number between 0-99
   */
  constructor(
    private readonly config: YieldOptimizationConfig,
    private readonly assetLoaderService: IAssetLoaderService,
    private readonly log: MoliLogger,
    private readonly randomTrafficShare?: () => number
  ) {
    this.trafficShare = randomTrafficShare || (() => Math.round(Math.random() * 99));
    switch (config.provider) {
      case 'none':
        log.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        this.adUnitPricingRules = Promise.resolve({});
        break;
      case 'static':
        log.warn('YieldOptimizationService', 'Yield optimization is static!');
        this.adUnitPricingRules = Promise.resolve(this.choosePriceRules(config.config));
        break;
      case 'dynamic':
        this.adUnitPricingRules = assetLoaderService
          .loadJson<ReadonlyArray<AdUnitPriceRules>>('yield-config.json', config.configEndpoint)
          .then(rules => {
            log.info('YieldOptimizationService', 'loaded pricing rules', rules);
            return this.choosePriceRules(rules);
          })
          .catch(error => {
            log.error('YieldOptimizationService', 'failed to initialize service', error);
            return {};
          });
        break;
      default:
        this.adUnitPricingRules = Promise.reject('Unknown config provider');
    }
  }

  /**
   * Return the price rule for the given ad slot domID if available.
   *
   * If the provider is `dynamic` this is an async operation as the configuration file might
   * not be loaded yet.
   *
   * @param adUnitDomId
   */
  public getPriceRule(adUnitDomId: string): Promise<PriceRule | undefined> {
    return this.adUnitPricingRules.then(rules => rules[adUnitDomId]);
  }

  /**
   * Sets the targeting for the given googletag ad slot if a price rule is defined for it.
   *
   * If the provider is `dynamic` this is an async operation as the configuration file might
   * not be loaded yet.
   *
   * @param adSlot
   */
  public setTargeting(adSlot: IAdSlot): Promise<void> {
    const adUnitDomId = adSlot.getSlotElementId();
    return this.getPriceRule(adUnitDomId)
      .then(rule => {
        if (rule) {
          this.log.debug('YieldOptimizationService', `set price rule id ${rule.priceRuleId}. Main traffic share ${!!rule.main}`);
          adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
          if (rule.main) {
            adSlot.setTargeting('upr_main', 'true');
          }
        } else {
          this.log.warn('YieldOptimizationService', `No price rule found for ${adUnitDomId}`);
        }
      });
  }

  private choosePriceRules(priceRules: ReadonlyArray<AdUnitPriceRules>): AdUnitsPriceRuleSelection {
    const adUnitPriceRules: AdUnitsPriceRuleSelection = {};

    priceRules.forEach(adUnitRules => {
      adUnitPriceRules[adUnitRules.adUnitName] = this.chooseAdUnitPriceRule(adUnitRules);
    });

    return adUnitPriceRules;
  }

  private chooseAdUnitPriceRule(adUnitPriceRules: AdUnitPriceRules): PriceRule {
    const share = this.trafficShare();
    // 20-99 is the 80% main traffic share
    if (share > 19) {
      return { ...adUnitPriceRules.main, main: true };
    }

    // 0 -19 is the 20% traffic share for A/B tests
    const priceRules = [ ...adUnitPriceRules.tests, adUnitPriceRules.main ];
    const index = share % priceRules.length;

    return priceRules[index];
  }

}
