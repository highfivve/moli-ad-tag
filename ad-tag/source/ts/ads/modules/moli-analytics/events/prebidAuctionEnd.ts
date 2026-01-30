import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';
import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';

export const mapPrebidAuctionEnd = (
  event: prebidjs.event.AuctionObject,
  context: EventContext,
  adContext: AdPipelineContext
): Events.Prebid.AuctionEnd => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'prebid.auctionEnd',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    userId: adContext.window__.pbjs.getUserIds().pubcid,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      auctionId: event.auctionId,
      adUnits: Array.from(
        new Map(
          (event.adUnits || []).map(adUnit => [
            adUnit.code!,
            {
              code: adUnit.code!,
              adUnitName: adUnit.pubstack?.adUnitName || adUnit.code!,
              gpid: adUnit.ortb2Imp?.ext?.gpid!
            }
          ])
        ).values()
      ),
      bidderRequests: (event.bidderRequests || []).map(request => {
        return {
          bidderCode: request.bidderCode!,
          bids: (request.bids || []).map(bid => ({
            adUnitCode: bid.adUnitCode
          }))
        };
      }),
      bidsReceived: (event.bidsReceived || []).map(bid => ({
        bidder: bid.bidder,
        adUnitCode: bid.adUnitCode,
        size: bid.size,
        currency: bid.currency,
        cpm: bid.cpm,
        timeToRespond: bid.timeToRespond
      }))
    }
  };
};
