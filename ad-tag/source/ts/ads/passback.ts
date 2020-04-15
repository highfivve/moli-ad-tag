import { PassbackService } from './passbackService';
import { PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';

export const passbackPrepareRequestAds = (passbackService: PassbackService): PrepareRequestAdsStep => (slots) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
  slots.filter(slot => slot.moliSlot.passbackSupport).forEach(slot => passbackService.addAdSlot(slot));
  resolve(slots);
});
