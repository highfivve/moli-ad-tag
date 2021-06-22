import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';
import MoliLogger = Moli.MoliLogger;
import IAdSlot = googletag.IAdSlot;
import { AdunitPriceRulesResponse, PriceRules, YieldOptimizationConfig } from './index';

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

export class YieldOptimizationService {
  /**
   * initialized with an resolved promise and no rules
   */
  private adUnitPricingRules: Promise<PriceRules> = Promise.resolve({});

  /**
   * true if the yield optimization is enabled (provider is not `none`) and init() was called.
   */
  private isEnabled: boolean = false;

  /**
   *
   */
  private device: 'mobile' | 'desktop' = 'mobile';

  /**
   *
   * @param yieldConfig the yield optimization config
   * @param log logging
   * @param window
   */
  constructor(
    private readonly yieldConfig: YieldOptimizationConfig,
    private readonly log: MoliLogger,
    private readonly window: Window
  ) {}

  /**
   *
   * @param labels - all available labels from moli. This includes the targeting labels as well as
   *         the `supportedLabels` from the LabelService.
   */
  public init(labels: string[]): Promise<void> {
    // if a desktop label is present, the yield optimization service will request desktop price rules
    // otherwise mobile
    this.device = labels.indexOf('desktop') > -1 ? 'desktop' : 'mobile';

    switch (this.yieldConfig.provider) {
      case 'none':
        this.log.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        this.isEnabled = false;
        this.adUnitPricingRules = Promise.resolve({});
        break;
      case 'static':
        this.log.warn('YieldOptimizationService', 'Yield optimization is static!');
        this.isEnabled = true;
        this.adUnitPricingRules = Promise.resolve(this.yieldConfig.config.rules);
        break;
      case 'dynamic':
        this.isEnabled = true;
        this.adUnitPricingRules = this.loadConfigWithRetry(this.yieldConfig.configEndpoint, 3)
          .then(config => {
            this.log.info(
              'YieldOptimizationService',
              `loaded pricing rules for device ${this.device}`,
              config
            );
            return config.rules;
          })
          .catch(error => {
            this.log.error('YieldOptimizationService', 'failed to initialize service', error);
            return {};
          });
        break;
      default:
        this.isEnabled = false;
        this.adUnitPricingRules = Promise.reject('Unknown config provider');
    }

    return Promise.resolve();
  }

  /**
   * Return the price rule for the given ad slot adUnitPath if available.
   *
   * If the provider is `dynamic` this is an async operation as the configuration file might
   * not be loaded yet.
   *
   * @param adUnitPath
   */
  public getPriceRule(adUnitPath: string): Promise<PriceRule | undefined> {
    return this.adUnitPricingRules.then(rules => rules[adUnitPath]);
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
    const adUnitPath = adSlot.getAdUnitPath();
    return this.getPriceRule(adUnitPath).then(rule => {
      if (rule) {
        this.log.debug(
          'YieldOptimizationService',
          `set price rule id ${rule.priceRuleId} for ${adUnitPath}. Main traffic share ${rule.main}. cpm is ${rule.floorprice}`
        );
        adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
        adSlot.setTargeting('upr_model', rule.model || 'static');
        if (rule.main) {
          adSlot.setTargeting('upr_main', 'true');
        }
      } else if (this.isEnabled) {
        this.log.warn('YieldOptimizationService', `No price rule found for ${adUnitPath}`);
      }
      return rule;
    });
  }

  private loadConfigWithRetry(
    configEndpoint: string,
    retriesLeft: number,
    lastError: any | null = null
  ): Promise<AdunitPriceRulesResponse> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    return this.window
      .fetch(configEndpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        //
        body: JSON.stringify({
          device: this.device,
          // GD-2996 - temporary migration to new key
          key: 'adUnitPath'
        })
      })
      .then(response => {
        return response.ok
          ? response.json()
          : response
              .text()
              .then(errorMessage => Promise.reject(`${response.statusText}: ${errorMessage}`));
      })
      .then((response: unknown) => {
        if (typeof response !== 'object') {
          return Promise.reject('response is not an object');
        }

        if (response === null) {
          return Promise.reject('response is null');
        }
        if (!this.isAdunitPricesRulesResponse(response)) {
          return Promise.reject('response is missing rules property');
        }

        if (this.validateRules(response.rules)) {
          return response;
        } else {
          return Promise.reject('At least one rule object was not valid');
        }
      })
      .catch(error => {
        // for 3 retries the backoff time will be 33ms / 50ms / 100ms
        const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
        return exponentialBackoff.then(() =>
          this.loadConfigWithRetry(configEndpoint, retriesLeft - 1, error)
        );
      });
  }

  private isAdunitPricesRulesResponse(obj: Object): obj is AdunitPriceRulesResponse {
    return obj.hasOwnProperty('rules');
  }

  private isPriceRules(obj: unknown): obj is PriceRules {
    return typeof obj === 'object' && obj !== null;
  }

  private validateRules(rules: unknown): rules is PriceRules {
    if (!this.isPriceRules(rules)) {
      return false;
    }

    return Object.keys(rules).every(adUnit => {
      const rule: any = rules[adUnit];
      return (
        typeof rule === 'object' &&
        rule !== null &&
        typeof rule.main === 'boolean' &&
        typeof rule.floorprice === 'number' &&
        typeof rule.priceRuleId === 'number'
      );
    });
  }
}
