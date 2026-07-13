/**
 * # Yield Optimization
 *
 * This module allows you to apply floor prices to all supporting bidders and setting
 * a unified pricing rule for GAM.
 *
 * ## Requirements
 *
 * - Unified pricing rules setup in GAM
 * - Server providing the yield configuration
 *
 * ## Integration
 *
 * In your `index.ts` import the generic-skin module and register it.
 *
 * ### Dynamic optimization
 *
 * This requires an endpoint that provides the yield config.
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({
 *   provider: 'dynamic',
 *   configEndpoint: 'https://yield.h5v.eu/config/gutefrage'
 * }, window));
 * ```
 *
 * ### Static
 *
 * For local testing or base settings you can define static rules.
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({
 *   provider: 'static',
 *   config: {
 *     rules: {
 *       'ad-unit-dom-id-1': {
 *         priceRuleId: 123,
 *         floorpirce: 0.1,
 *         main: true
 *       }
 *     }
 *   }
 * }, window));
 * ```
 *
 * ### None
 *
 * If you want to turn off the optimization you can also provide `none`
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({  provider: 'none'}, window));
 * ```
 * @module
 */
import {
  createYieldOptimizationService,
  YieldOptimizationService
} from './yieldOptimizationService';
import { createUprResetState, UprResetState } from './uprResetState';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  HIGH_PRIORITY,
  InitStep,
  mkConfigureStepOnce,
  mkInitStep,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { uniquePrimitiveFilter } from 'ad-tag/util/arrayUtils';
import { resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';

/**
 * == Yield Optimization ==
 *
 * The systems is designed to work with Google Ad Managers _Unified Pricing Rules_. The general idea is that
 * key values are being used to target specific pricing rules per ad unit. The configuration when a pricing rule
 * should be applied can be fetched from an external system to allow dynamic floor price optimizations.
 *
 * @see https://support.google.com/admanager/answer/9298008?hl=en
 */
export const YieldOptimization = (
  testYieldOptimizationService?: YieldOptimizationService
): IModule => {
  const name = 'YieldOptimization';
  const description = 'Provides floors and UPR ids';
  const moduleType: ModuleType = 'yield';

  let yieldModuleConfig: modules.yield_optimization.YieldOptimizationConfig | null = null;

  /**
   * Sticky UPR Reset state for the page session, marked by the Empty Refresh trigger (below)
   * and consulted by `setTargeting` on every cycle.
   *
   * @see docs/adr/0003-upr-reset-on-empty-or-sub-floor-bid.md
   */
  const uprResetState: UprResetState = createUprResetState();

  const _initSteps: InitStep[] = [];
  const _configureSteps: ConfigureStep[] = [];
  const _prepareRequestAdsSteps: PrepareRequestAdsStep[] = [];

  const config__ = (): Object | null => yieldModuleConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig): void => {
    if (moduleConfig?.yieldOptimization?.enabled) {
      yieldModuleConfig = moduleConfig.yieldOptimization;

      const yieldOptimizationService =
        testYieldOptimizationService ??
        createYieldOptimizationService(moduleConfig.yieldOptimization);

      _initSteps.push(yieldOptimizationInit(yieldOptimizationService));
      _prepareRequestAdsSteps.push(yieldOptimizationPrepareRequestAds(yieldOptimizationService));

      const uprReset = yieldModuleConfig.uprReset;
      if (uprReset) {
        _configureSteps.push(uprResetEmptyRefreshListener(uprReset));
      }
    }
  };

  const initSteps__ = (): InitStep[] => _initSteps;

  const configureSteps__ = (): ConfigureStep[] => _configureSteps;

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => _prepareRequestAdsSteps;

  const yieldOptimizationInit = (yieldOptimizationService: YieldOptimizationService): InitStep =>
    mkInitStep('yield-optimization-init', context => {
      const adUnitPaths = context.config__.slots
        .filter(slot => context.labelConfigService__.filterSlot(slot))
        .map(slot => slot.adUnitPath)
        .filter(uniquePrimitiveFilter);
      return yieldOptimizationService.init(
        context.labelConfigService__.getDeviceLabel(),
        context.adUnitPathVariables__,
        adUnitPaths,
        context.window__.fetch,
        context.logger__
      );
    });

  const yieldOptimizationPrepareRequestAds = (
    yieldOptimizationService: YieldOptimizationService
  ): PrepareRequestAdsStep =>
    mkPrepareRequestAdsStep(
      'yield-optimization',
      HIGH_PRIORITY,
      (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => {
        context.logger__.debug(
          'YieldOptimizationService',
          context.requestId__,
          'applying price rules'
        );
        const adServer = context.config__.adServer || 'gam';
        const slotsWithPriceRule = slots.map(slot => {
          return yieldOptimizationService
            .setTargeting(
              slot.adSlot,
              adServer,
              context.logger__,
              yieldModuleConfig,
              context.auction__,
              uprResetState
            )
            .then(priceRule => (slot.priceRule = priceRule));
        });
        return Promise.all(slotsWithPriceRule)
          .then(() => yieldOptimizationService.getBrowser())
          .then(browser => {
            if (context.env__ === 'production' && adServer === 'gam') {
              context.window__.googletag.setConfig({ targeting: { upr_browser: browser } });
            }
          });
      }
    );

  /**
   * UPR Reset's Empty Refresh trigger: the module's own `slotRenderEnded` listener, independent
   * of the ad-reload module. If an ad unit path's first ad request in a cycle comes back
   * genuinely empty, its floor is stripped (sticky, for the rest of the page session) and the
   * slot is refreshed once via `moli.refreshAdSlot`.
   *
   * Registered once for the page session. Suppressed for ad unit paths already reset - no retry
   * beyond that one refresh.
   *
   * @see docs/adr/0003-upr-reset-on-empty-or-sub-floor-bid.md
   */
  const uprResetEmptyRefreshListener = (
    uprReset: modules.yield_optimization.UprResetConfig
  ): ConfigureStep =>
    mkConfigureStepOnce('yield-optimization-upr-reset-empty-refresh', context => {
      const loadedBehaviourByDomId = new Map(
        context.config__.slots.map(slot => [slot.domId, slot.behaviour.loaded] as const)
      );

      context.window__.googletag.pubads().addEventListener('slotRenderEnded', event => {
        if (!event.isEmpty) {
          return;
        }

        const slotDomId = event.slot.getSlotElementId();
        if (uprReset.excludeAdSlotDomIds.indexOf(slotDomId) > -1) {
          return;
        }

        const loaded = loadedBehaviourByDomId.get(slotDomId);
        if (loaded === 'infinite') {
          return;
        }

        const adUnitPath = resolveAdUnitPath(
          event.slot.getAdUnitPath(),
          context.adUnitPathVariables__
        );

        if (uprResetState.isReset(adUnitPath)) {
          return;
        }

        uprResetState.markReset(adUnitPath);
        context.logger__.debug(
          'YieldOptimizationService',
          `UPR Reset (Empty Refresh): ${adUnitPath} came back empty, floor removed${
            uprReset.fallbackPriceRuleId
              ? `, fallback price rule ${uprReset.fallbackPriceRuleId} applied`
              : ''
          }. Refreshing ${slotDomId} once.`
        );

        context.window__.moli
          .refreshAdSlot(slotDomId, {
            ...(loaded && { loaded }),
            // this is a deliberate, one-off corrective refresh - a throttled/frequency-capped
            // no-op here would silently defeat the "no retry" guarantee of Empty Refresh
            force: true
          })
          .catch(error =>
            context.logger__.error(
              'YieldOptimizationService',
              `UPR Reset: refreshing ${slotDomId} failed`,
              error
            )
          );
      });

      return Promise.resolve();
    });

  return {
    name,
    configKey: 'yieldOptimization',
    description,
    moduleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};
