import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { googletag } from 'ad-tag/types/googletag';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

type DataProp = Pick<
  Events.GPT.SlotRenderEnded['payload']['data'],
  'sessionId' | 'pageViewId' | 'auctionId' | 'adUnitName' | 'analyticsLabels'
>;

export const mapGPTSlotRenderEnded = (
  event: googletag.events.ISlotRenderEndedEvent,
  context: AdPipelineContext,
  publisher: string,
  data: DataProp
): Events.GPT.SlotRenderEnded => {
  const timestamp = Date.now();
  const adUnitPath = event.slot.getAdUnitPath();
  const adUnitPathItems = adUnitPath.split('/');
  return {
    v: 1,
    type: 'gpt.slotRenderEnded',
    publisher,
    timestamp,
    payload: {
      timestamp: new Date(timestamp).toISOString(),
      data: {
        ...data,
        userId: context.runtimeConfig__.audience?.userId,
        adUnitPath,
        adUnitCode: event.slot.getSlotElementId(),
        isEmpty: event.isEmpty,
        size: event.size,
        device: context.labelConfigService__.getDeviceLabel(),
        domain: adUnitPathItems.at(-1) || context.window__.location.hostname.replace('www.', '')
      }
    }
  };
};
