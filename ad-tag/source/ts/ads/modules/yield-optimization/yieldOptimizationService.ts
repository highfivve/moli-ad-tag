import { AdServer, AdUnitPathVariables, Device, modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { googletag } from 'ad-tag/types/googletag';
import { GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { isYieldConfigDynamic } from 'ad-tag/ads/modules/yield-optimization/isYieldOptimizationConfigDynamic';
import { calculateDynamicPriceRule } from 'ad-tag/ads/modules/yield-optimization/dynamicFloorPrice';

/**
 * Extended representation which adds
 *
 * - a flag `main` indicating if the main traffic share price rule was selected
 * - a cpm field
 */
type PriceRule = MoliRuntime.yield_optimization.PriceRule & {
  /**
   * True if this price rule is the main price rule
   */
  readonly main?: boolean;
};

export class YieldOptimizationService {
  private readonly emptyAdUnitPriceRulesResponse: modules.yield_optimization.AdunitPriceRulesResponse =
    {
      rules: {},
      browser: 'None'
    };

  /**
   * initialized with an resolved promise and no rules
   */
  private adUnitPricingRuleResponse: Promise<modules.yield_optimization.AdunitPriceRulesResponse> =
    Promise.resolve(this.emptyAdUnitPriceRulesResponse);

  /**
   * true if the yield optimization is enabled (provider is not `none`) and init() was called.
   */
  private isEnabled: boolean = false;

  /**
   * The device for the current device
   */
  private device: Device = 'mobile';

  /**
   * Contains the device variable
   */
  private adUnitPathVariables = {};

  /**
   *
   * @param yieldConfig the yield optimization config
   */
  constructor(private readonly yieldConfig: modules.yield_optimization.YieldOptimizationConfig) {}

  /**
   *
   * @param device - the device label for the LabelConfigService
   * @param adUnitPathVariables - from the config targeting object
   * @param adUnitPaths All adUnitPaths configured in the slot config.
   * @param fetch
   * @param logger
   */
  public init(
    device: Device,
    adUnitPathVariables: AdUnitPathVariables,
    adUnitPaths: string[],
    fetch: typeof window.fetch,
    logger: MoliRuntime.MoliLogger
  ): Promise<void> {
    // if a desktop label is present, the yield optimization service will request desktop price rules
    // otherwise mobile
    this.device = device;
    this.adUnitPathVariables = adUnitPathVariables;

    switch (this.yieldConfig.provider) {
      case 'none':
        logger.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        this.isEnabled = false;
        this.adUnitPricingRuleResponse = Promise.resolve(this.emptyAdUnitPriceRulesResponse);
        break;
      case 'static':
        logger.warn('YieldOptimizationService', 'Yield optimization is static!');
        this.isEnabled = true;
        this.adUnitPricingRuleResponse = Promise.resolve({
          rules: (this.yieldConfig as modules.yield_optimization.StaticYieldOptimizationConfig)
            .config.rules,
          browser: 'None'
        });
        break;
      case 'dynamic':
        this.isEnabled = true;

        const excludedAdUnitPaths = (
          this.yieldConfig as modules.yield_optimization.DynamicYieldOptimizationConfig
        ).excludedAdUnitPaths;

        // The list of adUnitPaths we want to get the priceRules for.
        const filteredAdUnitPaths = adUnitPaths.filter(
          adUnitPath => excludedAdUnitPaths.indexOf(adUnitPath) < 0
        );

        const resolvedAdUnits = filteredAdUnitPaths.map(adUnitPath =>
          resolveAdUnitPath(adUnitPath, this.adUnitPathVariables)
        );

        this.adUnitPricingRuleResponse = this.loadConfigWithRetry(
          (this.yieldConfig as modules.yield_optimization.DynamicYieldOptimizationConfig)
            .configEndpoint,
          3,
          resolvedAdUnits,
          fetch
        )
          .then(config => {
            logger.info(
              'YieldOptimizationService',
              `loaded pricing rules for device ${this.device}`,
              config
            );
            return config;
          })
          .catch(error => {
            logger.error('YieldOptimizationService', 'failed to initialize service', error);
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
   * @param logger
   * @param yieldOptimizationConfig - needed to determine if the price rule should be calculated dynamically
   * @param auctionContext - place where previous bid cpms in order to determine dynamic floor price are saved
   */
  public setTargeting(
    adSlot: googletag.IAdSlot,
    adServer: AdServer,
    logger: MoliRuntime.MoliLogger,
    yieldOptimizationConfig: modules.yield_optimization.YieldOptimizationConfig | null,
    auctionContext?: GlobalAuctionContext
  ): Promise<PriceRule | undefined> {
    const adUnitPath = resolveAdUnitPath(adSlot.getAdUnitPath(), this.adUnitPathVariables);
    return this.adUnitPricingRuleResponse.then(config => {
      const rule = config.rules[adUnitPath];
      if (adServer === 'gam') {
        if (rule) {
          adSlot.setTargeting('upr_model', rule.model || 'static');
          if (rule.main) {
            adSlot.setTargeting('upr_main', 'true');
            const lastBidCpmsOnPosition: number[] | undefined =
              auctionContext?.getLastBidCpmsOfAdUnit(adSlot.getSlotElementId());
            /*
             * If in main group and if there were bids on the position, the price should be calculated based on the previous cpms
             * saved in the previousBidCpms extension of the global auction context.
             * The strategy is dependent on the dynamic yield optimization config.
             */
            if (
              lastBidCpmsOnPosition &&
              lastBidCpmsOnPosition?.length > 0 &&
              isYieldConfigDynamic(yieldOptimizationConfig) &&
              yieldOptimizationConfig.dynamicFloorPrices
            ) {
              const { strategy, roundingStepsInCents, maxPriceRuleInCents, minPriceRuleInCents } =
                yieldOptimizationConfig.dynamicFloorPrices;
              const newRule = calculateDynamicPriceRule({
                strategy,
                previousCpms: lastBidCpmsOnPosition,
                standardRule: rule,
                roundingStepsInCents,
                maxPriceRuleInCents,
                minPriceRuleInCents
              });
              logger.debug(
                'YieldOptimizationService',
                `set dynamic price rule id ${newRule.priceRuleId} for ${adUnitPath} based on previous bid cpms on same position. Stategy is '${strategy}'. Main traffic share ${rule.main}. Cpm is ${newRule.floorprice}.`
              );
              adSlot.setTargeting('upr_id', newRule.priceRuleId.toFixed(0));
              return newRule;
            } else {
              adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
            }
          } else {
            // if not in main group, use the price rule determined by the yield optimization
            logger.debug(
              'YieldOptimizationService',
              `set price rule id ${rule.priceRuleId} for ${adUnitPath}. Main traffic share ${rule.main}. cpm is ${rule.floorprice}`
            );
            adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
          }
        } else if (this.isEnabled) {
          logger.warn('YieldOptimizationService', `No price rule found for ${adUnitPath}`);
        }
      }
      return rule;
    });
  }

  private loadConfigWithRetry(
    configEndpoint: string,
    retriesLeft: number,
    adUnitPaths: string[],
    fetch: typeof window.fetch,
    lastError: any | null = null
  ): Promise<modules.yield_optimization.AdunitPriceRulesResponse> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    return fetch(configEndpoint, {
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
          this.loadConfigWithRetry(configEndpoint, retriesLeft - 1, adUnitPaths, fetch, error)
        );
      });
  }

  private isAdunitPricesRulesResponse(
    obj: Object
  ): obj is modules.yield_optimization.AdunitPriceRulesResponse {
    return obj.hasOwnProperty('rules');
  }

  private isPriceRules(obj: unknown): obj is modules.yield_optimization.PriceRules {
    return typeof obj === 'object' && obj !== null;
  }

  private validateRules(rules: unknown): rules is modules.yield_optimization.PriceRules {
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
