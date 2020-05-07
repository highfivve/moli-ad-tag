import { AdPipelineContext, HIGH_PRIORITY, mkPrepareRequestAdsStep, PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { YieldOptimizationService } from './yieldOptimizationService';

/**
 * This step adds a `priceRule` to the slot definition if possible. It does so by **mutating**
 * the slot definition.
 *
 * @param yieldOptimizationService
 */
export const yieldOptimizationPrepareRequestAds = (yieldOptimizationService: YieldOptimizationService): PrepareRequestAdsStep => mkPrepareRequestAdsStep(
  'yield-optimiziation',
  HIGH_PRIORITY,
  (context: AdPipelineContext, slots: SlotDefinition[]) => {
    context.logger.debug('YieldOptimizationService', context.requestId, 'applying price rules');
    const slotsWithPriceRule = slots.map(slot => {
      return yieldOptimizationService.setTargeting(slot.adSlot).then(priceRule => slot.priceRule = priceRule);
    });
    return Promise.all(slotsWithPriceRule);
  }
);
