import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { googletag } from 'ad-tag/types/googletag';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

export const mapGPTSlotRenderEnded = (
  event: googletag.events.ISlotRenderEndedEvent,
  context: AdPipelineContext,
  publisher: string,
  sessionId: string,
  pageViewId: string,
  analyticsLabels: Events.AnalyticsLabels
): Events.GPT.SlotRenderEnded => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'gpt.slotRenderEnded',
    publisher,
    timestamp,
    payload: {
      timestamp: new Date(timestamp).toISOString(),
      data: {
        analyticsLabels,
        adUnitPath: event.slot.getAdUnitPath(),
        isEmpty: event.isEmpty,
        size: event.size,
        sessionId,
        pageViewId
      },
      prebidRef: {
        auctionId: context.auctionId__
      }
    }
  };
};
