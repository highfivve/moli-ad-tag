import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

export const mapPrebidBidWon = (
  response: prebidjs.BidResponse,
  publisher: string,
  analyticsLabels: Events.AnalyticsLabels
): Events.Prebid.BidWon => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'prebid.bidWon',
    publisher,
    timestamp,
    payload: {
      timestamp: new Date(timestamp).toISOString(),
      data: {
        analyticsLabels,
        bidderCode: response.bidderCode,
        auctionId: response.auctionId,
        adUnitCode: response.adUnitCode,
        transactionId: response.transactionId!,
        requestId: response.requestId,
        currency: response.currency,
        cpm: response.cpm,
        size: response.size,
        status: response.status!,
        timeToRespond: response.timeToRespond
      }
    }
  };
};
