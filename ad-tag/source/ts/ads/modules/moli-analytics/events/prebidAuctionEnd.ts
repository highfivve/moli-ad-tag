import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

export const mapPrebidAuctionEnd = (
  auction: prebidjs.event.AuctionObject,
  publisher: string,
  analyticsLabels: Events.AnalyticsLabels
): Events.Prebid.AuctionEnd => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'prebid.auctionEnd',
    publisher: publisher,
    timestamp,
    payload: {
      timestamp: new Date(timestamp).toISOString(),
      data: {
        analyticsLabels,
        auctionId: auction.auctionId,
        adUnits: (auction.adUnits || []).map(adUnit => ({
          code: adUnit.code!,
          transactionId: adUnit.transactionId!,
          adUnitName: adUnit.pubstack?.adUnitName
        })),
        bidderRequests: (auction.bidderRequests || []).map(request => {
          return {
            bidderCode: request.bidderCode!,
            auctionId: request.auctionId!,
            bids: (request.bids || []).map(bid => ({
              bidder: bid.bidder,
              adUnitCode: bid.adUnitCode,
              sizes: bid.sizes,
              bidId: bid.bidId!
            })),
            ortb2: {
              device: {
                ua: request?.ortb2?.device?.ua || window.navigator.userAgent,
                sua: request?.ortb2?.device?.sua || null
              }
            }
          };
        }),
        bidsReceived: (auction.bidsReceived || []).map(bid => ({
          bidder: bid.bidder,
          adUnitCode: bid.adUnitCode,
          requestId: bid.requestId,
          transactionId: bid.transactionId!,
          currency: bid.currency,
          cpm: bid.cpm,
          size: bid.size,
          timeToRespond: bid.timeToRespond
        }))
      }
    }
  };
};
