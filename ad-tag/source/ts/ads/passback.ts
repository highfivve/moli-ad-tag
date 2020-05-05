import { PassbackService } from './passbackService';
import { AdPipelineContext, LOW_PRIORITY, mkPrepareRequestAdsStep, PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';

export const passbackPrepareRequestAds = (passbackService: PassbackService): PrepareRequestAdsStep => mkPrepareRequestAdsStep(
  (context: AdPipelineContext, slots) => new Promise(resolve => {
      slots.filter(slot => slot.moliSlot.passbackSupport).forEach(slot => passbackService.addAdSlot(slot));
      resolve();
  }),
  LOW_PRIORITY
);
