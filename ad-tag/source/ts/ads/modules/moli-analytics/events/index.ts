import { mapPrebidAuctionEnd } from 'ad-tag/ads/modules/moli-analytics/events/prebidAuctionEnd';
import { mapPrebidBidWon } from 'ad-tag/ads/modules/moli-analytics/events/prebidBidWon';
import { mapGPTSlotRenderEnded } from 'ad-tag/ads/modules/moli-analytics/events/gptSlotRenderEnded';
import { mapPageView } from 'ad-tag/ads/modules/moli-analytics/events/pageView';

export const eventMapper = {
  prebid: {
    auctionEnd: mapPrebidAuctionEnd,
    bidWon: mapPrebidBidWon
  },
  gpt: {
    slotRenderEnded: mapGPTSlotRenderEnded
  },
  page: {
    view: mapPageView
  }
};
