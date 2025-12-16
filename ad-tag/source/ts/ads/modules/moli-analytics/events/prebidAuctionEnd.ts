import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';
import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';

export const mapPrebidAuctionEnd = (
  auction: prebidjs.event.AuctionObject,
  context: AdPipelineContext,
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
        adUnits: Array.from(
          new Map(
            (auction.adUnits || []).map(adUnit => [
              adUnit.code!,
              {
                code: adUnit.code!,
                adUnitName: adUnit.pubstack?.adUnitName || adUnit.code!
              }
            ])
          ).values()
        ),
        bidderRequests: (auction.bidderRequests || []).map(request => {
          return {
            auctionId: request.auctionId!,
            bidderCode: request.bidderCode!,
            bids: (request.bids || []).map(bid => ({
              bidder: bid.bidder,
              adUnitCode: bid.adUnitCode,
              sizes: bid.sizes,
              bidId: bid.bidId!
            })),
            ortb2: {
              device: {
                ua: request?.ortb2?.device?.ua || context.window__.navigator.userAgent,
                sua: request?.ortb2?.device?.sua || null
              }
            }
          };
        }),
        bidsReceived: (auction.bidsReceived || []).map(bid => ({
          bidder: bid.bidder,
          adUnitCode: bid.adUnitCode,
          currency: bid.currency,
          cpm: bid.cpm,
          size: bid.size,
          timeToRespond: bid.timeToRespond
        }))
      }
    }
  };
};
