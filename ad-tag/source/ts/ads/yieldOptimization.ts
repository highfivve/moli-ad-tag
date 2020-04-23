import { AdPipelineContext, PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { YieldOptimizationService } from './yieldOptimizationService';

export const yieldOptimizationPrepareRequestAds = (yieldOptimizationService: YieldOptimizationService): PrepareRequestAdsStep => (context: AdPipelineContext, slots: SlotDefinition<any>[]) => {
  const slotsWithPriceRule = slots.map(slot => yieldOptimizationService.setTargeting(slot.adSlot));
  return Promise.all(slotsWithPriceRule).then(() => slots);
};
