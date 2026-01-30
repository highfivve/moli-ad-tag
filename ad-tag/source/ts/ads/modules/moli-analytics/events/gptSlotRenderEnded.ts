import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { googletag } from 'ad-tag/types/googletag';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';

type SlotRenderEndedContext = EventContext &
  Pick<Events.GPT.SlotRenderEnded['data'], 'auctionId' | 'adUnitName' | 'gpid'>;

export const mapGPTSlotRenderEnded = (
  event: googletag.events.ISlotRenderEndedEvent,
  context: SlotRenderEndedContext,
  adContext: AdPipelineContext
): Events.GPT.SlotRenderEnded => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'gpt.slotRenderEnded',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    userId: adContext.window__.pbjs.getUserIds().pubcid,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      auctionId: context.auctionId,
      gpid: context.gpid,
      adUnitPath: event.slot.getAdUnitPath(),
      adUnitName: context.adUnitName,
      adUnitCode: event.slot.getSlotElementId(),
      size: Array.isArray(event.size) ? event.size.join('x') : event.size,
      isEmpty: event.isEmpty
    }
  };
};
