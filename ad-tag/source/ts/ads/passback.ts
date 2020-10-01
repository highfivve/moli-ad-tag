import { PassbackService } from './passbackService';
import {
  AdPipelineContext,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from './adPipeline';

export const passbackPrepareRequestAds = (
  passbackService: PassbackService
): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'passback-prepare-slots',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots) =>
      new Promise(resolve => {
        slots
          .filter(slot => slot.moliSlot.passbackSupport)
          .forEach(slot => {
            context.logger.debug('passback', 'add passback support for slot', slot.moliSlot.domId);
            passbackService.addAdSlot(slot);
          });
        resolve();
      })
  );
