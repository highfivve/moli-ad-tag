import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { googletag } from 'ad-tag/types/googletag';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';

type SlotRenderEndedContext = EventContext &
  Pick<Events.GPT.SlotRenderEnded['data'], 'auctionId' | 'adUnitName'>;

export const mapGPTSlotRenderEnded = (
  event: googletag.events.ISlotRenderEndedEvent,
  context: SlotRenderEndedContext,
  adContext: AdPipelineContext
): Events.GPT.SlotRenderEnded => {
  const timestamp = Date.now();
  const adUnitPath = event.slot.getAdUnitPath();
  return {
    v: 1,
    type: 'gpt.slotRenderEnded',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      auctionId: context.auctionId,
      userId: adContext.runtimeConfig__.audience?.userId,
      adUnitPath,
      adUnitName: context.adUnitName,
      adUnitCode: event.slot.getSlotElementId(),
      size: Array.isArray(event.size) ? event.size.join('x') : event.size,
      isEmpty: event.isEmpty
    }
  };
};
