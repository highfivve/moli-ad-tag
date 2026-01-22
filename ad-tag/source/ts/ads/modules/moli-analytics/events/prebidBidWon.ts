import type { prebidjs } from 'ad-tag/types/prebidjs';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';
import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';

type BidWonContext = EventContext & Pick<Events.Prebid.BidWon['data'], 'gpid'>;

export const mapPrebidBidWon = (
  event: prebidjs.BidResponse,
  context: BidWonContext,
  adContext: AdPipelineContext
): Events.Prebid.BidWon => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'prebid.bidWon',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    userId: adContext.window__.pbjs.getUserIds().pubcid,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      auctionId: event.auctionId,
      gpid: context.gpid,
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
