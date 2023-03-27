import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';
import MoliLogger = Moli.MoliLogger;
import IAdSlot = googletag.IAdSlot;
import { AdunitPriceRulesResponse, PriceRules, YieldOptimizationConfig } from './index';
import { AdUnitPathVariables, resolveAdUnitPath } from '@highfivve/ad-tag';

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
  private readonly emptyAdUnitPriceRulesResponse: AdunitPriceRulesResponse = {
    rules: {},
    browser: 'None'
  };

  /**
   * initialized with an resolved promise and no rules
   */
  private adUnitPricingRuleResponse: Promise<AdunitPriceRulesResponse> = Promise.resolve(
    this.emptyAdUnitPriceRulesResponse
  );

  /**
   * true if the yield optimization is enabled (provider is not `none`) and init() was called.
   */
  private isEnabled: boolean = false;

  /**
   * The device for the current device
   */
  private device: 'mobile' | 'desktop' = 'mobile';

  /**
   * Contains the device variable
   */
  private adUnitPathVariables = {};

  /**
   *
   * @param yieldConfig the yield optimization config
   * @param log
   * @param window
   */
  constructor(
    private readonly yieldConfig: YieldOptimizationConfig,
    private readonly log: MoliLogger,
    private readonly window: Window
  ) {}

  /**
   *
   * @param device - the device label for the LabelConfigService
   * @param adUnitPathVariables - from the config targeting object
   * @param adUnitPaths All adUnitPaths configured in the slot config.
   */
  public init(
    device: 'mobile' | 'desktop',
    adUnitPathVariables: AdUnitPathVariables,
    adUnitPaths: string[]
  ): Promise<void> {
    // if a desktop label is present, the yield optimization service will request desktop price rules
    // otherwise mobile
    this.device = device;
    this.adUnitPathVariables = adUnitPathVariables;

    switch (this.yieldConfig.provider) {
      case 'none':
        this.log.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        this.isEnabled = false;
        this.adUnitPricingRuleResponse = Promise.resolve(this.emptyAdUnitPriceRulesResponse);
        break;
      case 'static':
        this.log.warn('YieldOptimizationService', 'Yield optimization is static!');
        this.isEnabled = true;
        this.adUnitPricingRuleResponse = Promise.resolve({
          rules: this.yieldConfig.config.rules,
          browser: 'None'
        });
        break;
      case 'dynamic':
        this.isEnabled = true;

        const excludedAdUnitPaths = this.yieldConfig.excludedAdUnitPaths;

        // The list of adUnitPaths we want to get the priceRules for.
        const filteredAdUnitPaths = adUnitPaths.filter(
          adUnitPath => excludedAdUnitPaths.indexOf(adUnitPath) < 0
        );

        const resolvedAdUnits = filteredAdUnitPaths.map(adUnitPath =>
          resolveAdUnitPath(adUnitPath, this.adUnitPathVariables)
        );

        this.adUnitPricingRuleResponse = this.loadConfigWithRetry(
          this.yieldConfig.configEndpoint,
          3,
          resolvedAdUnits
        )
          .then(config => {
            this.log.info(
              'YieldOptimizationService',
              `loaded pricing rules for device ${this.device}`,
              config
            );
            return config;
          })
          .catch(error => {
            this.log.error('YieldOptimizationService', 'failed to initialize service', error);
            return this.emptyAdUnitPriceRulesResponse;
          });
        break;
      default:
        this.isEnabled = false;
        this.adUnitPricingRuleResponse = Promise.reject('Unknown config provider');
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
    return this.adUnitPricingRuleResponse.then(
      response => response.rules[resolveAdUnitPath(adUnitPath, this.adUnitPathVariables)]
    );
  }

  /**
   * Returns the detected browser for the user agent
   */
  public getBrowser(): Promise<string> {
    return this.adUnitPricingRuleResponse.then(response => response.browser || 'None');
  }

  /**
   * Sets the targeting for the given googletag ad slot if a price rule is defined for it.
   *
   * If the provider is `dynamic` this is an async operation as the configuration file might
   * not be loaded yet.
   *
   * @param adSlot
   * @param adServer
   */
  public setTargeting(adSlot: IAdSlot, adServer: Moli.AdServer): Promise<PriceRule | undefined> {
    const adUnitPath = resolveAdUnitPath(adSlot.getAdUnitPath(), this.adUnitPathVariables);
    return this.adUnitPricingRuleResponse.then(config => {
      const rule = config.rules[adUnitPath];
      if (adServer === 'gam') {
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
      }
      return rule;
    });
  }

  private loadConfigWithRetry(
    configEndpoint: string,
    retriesLeft: number,
    adUnitPaths: string[],
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
          key: 'adUnitPath',
          // GD-3821 - send adUnitPaths for alarm on misconfigured adUnits
          adUnitPaths: adUnitPaths
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
