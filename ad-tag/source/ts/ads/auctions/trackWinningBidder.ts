import { prebidjs } from '../../types/prebidjs';

export interface TrackWinningBidder {
  onBidWon(bid: prebidjs.BidResponse): void | undefined;
  getLastWinningBidderOnAdUnit(adUnitCode: string): prebidjs.BidderCode | undefined;
}

export const createTrackWinningBidder = (): TrackWinningBidder => {
  const lastWinningBidderByAdUnit = new Map<string, prebidjs.BidderCode>();

  const onBidWon = (winningBid: prebidjs.BidResponse): void => {
    lastWinningBidderByAdUnit.set(winningBid.adUnitCode, winningBid.bidderCode);
  };

  const getLastWinningBidderOnAdUnit = (slotId: string): prebidjs.BidderCode | undefined => {
    return lastWinningBidderByAdUnit.get(slotId);
  };

  return {
    onBidWon,
    getLastWinningBidderOnAdUnit
  };
};
