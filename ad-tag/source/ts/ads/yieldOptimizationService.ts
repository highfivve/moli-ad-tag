import { IAssetLoaderService } from '../util/assetLoaderService';
import { Moli } from '../types/moli';
import { googletag } from '../types/googletag';
import YieldOptimizationConfig = Moli.yield_optimization.YieldOptimizationConfig;
import AdUnitPriceRules = Moli.yield_optimization.AdUnitPriceRules;
import MoliLogger = Moli.MoliLogger;
import IAdSlot = googletag.IAdSlot;
import PublisherYieldConfiguration = Moli.yield_optimization.PublisherYieldConfiguration;

/**
 * Extended representation which adds
 *
 * - a flag `main` indicating if the main traffic share price rule was selected
 * - a cpm field
 */
type PriceRule = Moli.yield_optimization.PriceRule & {

  /**
   * True if this price rule is the main price rule
   */
  readonly main?: boolean;

};
type AdUnitsPriceRuleSelection = {
  [adUnit: string]: PriceRule
};

const priceRuleCpm: { [priceRuleId: string]: number } = {
  39836957: 0.10,
  39558984: 0.15,
  39837386: 0.20,
  39837404: 0.25,
  39837407: 0.30,
  39707353: 0.35,
  39559011: 0.40,
  39707371: 0.45,
  39555171: 0.50,
  39707764: 0.55,
  39703039: 0.60,
  39709219: 0.65,
  39702961: 0.70,
  39561393: 0.75,
  39703048: 0.80,
  39709210: 0.85,
  39561366: 0.90,
  39708829: 0.95,
  39707350: 1.00,
  39837458: 1.05,
  39707362: 1.10,
  39707377: 1.15,
  39837476: 1.20,
  39707761: 1.25,
  39707839: 1.30,
  39560475: 1.35,
  39560481: 1.40,
  39560484: 1.45,
  39560490: 1.50,
  39560493: 1.55,
  39560496: 1.60,
  39708772: 1.65,
  39560508: 1.70,
  39708781: 1.75,
  39560901: 1.80,
  39560913: 1.85,
  39560982: 1.90,
  39702598: 1.95,
  39560997: 2.00
};

export class YieldOptimizationService {

  private readonly adUnitPricingRules: Promise<AdUnitsPriceRuleSelection>;

  /**
   * Generates a number between [0-99]
   */
  private readonly trafficShare: () => number;

  /**
   * true if the yield optimization is enabled (provider is not `none`)
   */
  private readonly isEnabled: boolean;

  /**
   *
   * @param yieldConfig the yield optimization config
   * @param assetLoaderService required to load dynamic yield configurations
   * @param log logging
   * @param randomTrafficShare must generate a number between 0-99
   */
  constructor(
    private readonly yieldConfig: YieldOptimizationConfig,
    private readonly assetLoaderService: IAssetLoaderService,
    private readonly log: MoliLogger,
    private readonly randomTrafficShare?: () => number
  ) {
    this.trafficShare = randomTrafficShare || (() => Math.round(Math.random() * 99));
    switch (yieldConfig.provider) {
      case 'none':
        log.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        this.isEnabled = false;
        this.adUnitPricingRules = Promise.resolve({});
        break;
      case 'static':
        log.warn('YieldOptimizationService', 'Yield optimization is static!');
        this.isEnabled = true;
        this.adUnitPricingRules = Promise.resolve(this.choosePriceRules(yieldConfig.config.rules));
        break;
      case 'dynamic':
        this.isEnabled = true;
        this.adUnitPricingRules = assetLoaderService
          .loadJson<PublisherYieldConfiguration>('yield-config.json', yieldConfig.configEndpoint)
          .then(config => {
            log.info('YieldOptimizationService', 'loaded pricing rules', config);
            return this.choosePriceRules(config.rules);
          })
          .catch(error => {
            log.error('YieldOptimizationService', 'failed to initialize service', error);
            return {};
          });
        break;
      default:
        this.isEnabled = false;
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
    return this.adUnitPricingRules.then(rules => {
      const priceRule = rules[adUnitDomId];
      if (priceRule) {
        const cpm: number | undefined = priceRuleCpm[priceRule.priceRuleId.toFixed(0)];
        return { ...priceRule, cpm };
      }
      return;
    });
  }

  /**
   * Sets the targeting for the given googletag ad slot if a price rule is defined for it.
   *
   * If the provider is `dynamic` this is an async operation as the configuration file might
   * not be loaded yet.
   *
   * @param adSlot
   */
  public setTargeting(adSlot: IAdSlot): Promise<PriceRule | undefined> {
    const adUnitDomId = adSlot.getSlotElementId();
    return this.getPriceRule(adUnitDomId)
      .then(rule => {
        if (rule) {
          this.log.debug('YieldOptimizationService', `set price rule id ${rule.priceRuleId}. Main traffic share ${!!rule.main}`);
          adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
          if (rule.main) {
            adSlot.setTargeting('upr_main', 'true');
          }
        } else if (this.isEnabled) {
          this.log.warn('YieldOptimizationService', `No price rule found for ${adUnitDomId}`);
        }
        return rule;
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
