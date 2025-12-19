import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';

export const mapPrebidBidWon = (
  event: prebidjs.BidResponse,
  context: EventContext
): Events.Prebid.BidWon => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'prebid.bidWon',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      auctionId: event.auctionId,
      bidderCode: event.bidderCode,
      adUnitCode: event.adUnitCode,
      size: event.size,
      currency: event.currency,
      cpm: event.cpm,
      status: event.status!,
      timeToRespond: event.timeToRespond
    }
  };
};
