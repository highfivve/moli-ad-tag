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

/**
 * The delivered `upr_model` values whose `upr_id` is a price ladder rule id, and which
 * `dynamicFloorPrice` may therefore rewrite.
 *
 * For a Google-priced (`g`) rule `upr_id` is the target CPM in euro cents, or `0` for Google
 * Optimized; for `disabled` it is the €0.01 marker. Rewriting either into a ladder rule id would
 * produce a value matching no pricing rule at all.
 */
const dynamicFloorPriceModels: ReadonlyArray<MoliRuntime.yield_optimization.UprModel> = [
  'static',
  'fixed'
];

/** The model a price rule is treated as when the config endpoint sends none. */
const fallbackModel: MoliRuntime.yield_optimization.UprModel = 'static';

/**
 * The delivered model of a price rule, with the fallback applied.
 *
 * `||`, not `??`: `model` is not validated at runtime, so an endpoint could deliver an empty
 * string. Treating that as `static` is what the `upr_model` key-value has always done.
 */
const modelOf = (
  rule: MoliRuntime.yield_optimization.PriceRule
): MoliRuntime.yield_optimization.UprModel => rule.model || fallbackModel;

export interface YieldOptimizationService {
  init(
    device: Device,
    adUnitPathVariables: AdUnitPathVariables,
    adUnitPaths: string[],
    fetch: typeof window.fetch,
    logger: MoliRuntime.MoliLogger
  ): Promise<void>;

  getPriceRule(adUnitPath: string): Promise<PriceRule | undefined>;

  getBrowser(): Promise<string>;

  setTargeting(
    adSlot: googletag.IAdSlot,
    adServer: AdServer,
    logger: MoliRuntime.MoliLogger,
    yieldOptimizationConfig: modules.yield_optimization.YieldOptimizationConfig | null,
    auctionContext?: GlobalAuctionContext
  ): Promise<PriceRule | undefined>;
}
export const createYieldOptimizationService = (
  yieldConfig: modules.yield_optimization.YieldOptimizationConfig
): YieldOptimizationService => {
  const emptyAdUnitPriceRulesResponse: modules.yield_optimization.AdunitPriceRulesResponse = {
    rules: {},
    browser: 'None'
  };

  let adUnitPricingRuleResponse: Promise<modules.yield_optimization.AdunitPriceRulesResponse> =
    Promise.resolve(emptyAdUnitPriceRulesResponse);

  let isEnabled = false;
  let device: Device = 'mobile';
  let adUnitPathVariables = {};

  const init = (
    deviceLabel: Device,
    adUnitPathVars: AdUnitPathVariables,
    adUnitPaths: string[],
    fetch: typeof window.fetch,
    logger: MoliRuntime.MoliLogger
  ): Promise<void> => {
    device = deviceLabel;
    adUnitPathVariables = adUnitPathVars;

    switch (yieldConfig.provider) {
      case 'none':
        logger.warn('YieldOptimizationService', 'Yield optimization is disabled!');
        isEnabled = false;
        adUnitPricingRuleResponse = Promise.resolve(emptyAdUnitPriceRulesResponse);
        break;
      case 'static':
        logger.warn('YieldOptimizationService', 'Yield optimization is static!');
        isEnabled = true;
        adUnitPricingRuleResponse = Promise.resolve({
          rules: (yieldConfig as modules.yield_optimization.StaticYieldOptimizationConfig).config
            .rules,
          browser: 'None'
        });
        break;
      case 'dynamic':
        isEnabled = true;

        const excludedAdUnitPaths = (
          yieldConfig as modules.yield_optimization.DynamicYieldOptimizationConfig
        ).excludedAdUnitPaths;

        const filteredAdUnitPaths = adUnitPaths.filter(
          adUnitPath => excludedAdUnitPaths.indexOf(adUnitPath) < 0
        );

        const resolvedAdUnits = filteredAdUnitPaths.map(adUnitPath =>
          resolveAdUnitPath(adUnitPath, adUnitPathVariables)
        );

        adUnitPricingRuleResponse = loadConfigWithRetry(
          (yieldConfig as modules.yield_optimization.DynamicYieldOptimizationConfig).configEndpoint,
          3,
          resolvedAdUnits,
          fetch
        )
          .then(config => {
            logger.info(
              'YieldOptimizationService',
              `loaded pricing rules for device ${device}`,
              config
            );
            return config;
          })
          .catch(error => {
            logger.error('YieldOptimizationService', 'failed to initialize service', error);
            return emptyAdUnitPriceRulesResponse;
          });
        break;
      default:
        isEnabled = false;
        adUnitPricingRuleResponse = Promise.reject('Unknown config provider');
    }

    return Promise.resolve();
  };

  const getPriceRule = (adUnitPath: string): Promise<PriceRule | undefined> => {
    return adUnitPricingRuleResponse.then(
      response => response.rules[resolveAdUnitPath(adUnitPath, adUnitPathVariables)]
    );
  };

  const getBrowser = (): Promise<string> => {
    return adUnitPricingRuleResponse.then(response => response.browser || 'None');
  };

  const setTargeting = (
    adSlot: googletag.IAdSlot,
    adServer: AdServer,
    logger: MoliRuntime.MoliLogger,
    yieldOptimizationConfig: modules.yield_optimization.YieldOptimizationConfig | null,
    auctionContext?: GlobalAuctionContext
  ): Promise<PriceRule | undefined> => {
    const adUnitPath = resolveAdUnitPath(adSlot.getAdUnitPath(), adUnitPathVariables);
    return adUnitPricingRuleResponse.then(config => {
      const rule = config.rules[adUnitPath];
      if (adServer === 'gam') {
        if (rule) {
          adSlot.setTargeting('upr_model', modelOf(rule));
          if (rule.main) {
            adSlot.setTargeting('upr_main', 'true');
            const lastBidCpmsOnPosition: number[] | undefined =
              auctionContext?.getLastBidCpmsOfAdUnit(adSlot.getSlotElementId());
            if (
              lastBidCpmsOnPosition &&
              lastBidCpmsOnPosition?.length > 0 &&
              dynamicFloorPriceModels.includes(modelOf(rule)) &&
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
            logger.debug(
              'YieldOptimizationService',
              `set price rule id ${rule.priceRuleId} for ${adUnitPath}. Main traffic share ${rule.main}. cpm is ${rule.floorprice ?? 'not set'}`
            );
            adSlot.setTargeting('upr_id', rule.priceRuleId.toFixed(0));
          }
        } else if (isEnabled) {
          logger.warn('YieldOptimizationService', `No price rule found for ${adUnitPath}`);
        }
      }
      return rule;
    });
  };

  const loadConfigWithRetry = (
    configEndpoint: string,
    retriesLeft: number,
    adUnitPaths: string[],
    fetch: typeof window.fetch,
    lastError: any | null = null
  ): Promise<modules.yield_optimization.AdunitPriceRulesResponse> => {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    const supportedModels: MoliRuntime.yield_optimization.UprModel[] = [
      'static',
      'fixed',
      'g',
      'disabled'
    ];

    return fetch(configEndpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        device: device,
        key: 'adUnitPath',
        adUnitPaths: adUnitPaths,
        floorModels: supportedModels
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
        if (typeof response !== 'object' || response === null) {
          return Promise.reject('Invalid response');
        }
        if (!isAdunitPricesRulesResponse(response)) {
          return Promise.reject('response is missing rules property');
        }
        if (validateRules(response.rules)) {
          return response;
        } else {
          return Promise.reject('At least one rule object was not valid');
        }
      })
      .catch(error => {
        const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
        return exponentialBackoff.then(() =>
          loadConfigWithRetry(configEndpoint, retriesLeft - 1, adUnitPaths, fetch, error)
        );
      });
  };

  const isAdunitPricesRulesResponse = (
    obj: Object
  ): obj is modules.yield_optimization.AdunitPriceRulesResponse => {
    return obj.hasOwnProperty('rules');
  };

  const isPriceRules = (obj: unknown): obj is modules.yield_optimization.PriceRules => {
    return typeof obj === 'object' && obj !== null;
  };

  /**
   * `undefined` or a number. Both prices on a price rule are optional, and this validation runs
   * with `every`: rejecting one rule rejects the entire response, which would cost the publisher
   * `upr_id` targeting on every ad unit rather than just a floor on one.
   */
  const isOptionalNumber = (value: unknown): value is number | undefined =>
    value === undefined || typeof value === 'number';

  const validateRules = (rules: unknown): rules is modules.yield_optimization.PriceRules => {
    if (!isPriceRules(rules)) {
      return false;
    }

    return Object.keys(rules).every(adUnit => {
      const rule: any = rules[adUnit];
      return (
        typeof rule === 'object' &&
        rule !== null &&
        typeof rule.main === 'boolean' &&
        isOptionalNumber(rule.floorprice) &&
        isOptionalNumber(rule.pbFloor) &&
        typeof rule.priceRuleId === 'number'
      );
    });
  };

  return {
    init,
    getPriceRule,
    getBrowser,
    setTargeting
  };
};
