import { prebidjs } from '../../types/prebidjs';

export interface PreviousBidCpms {
  groupReceivedBidsByAdUnitCode(bidsReceived: prebidjs.BidResponse[]): { [key: string]: number[] };
  onAuctionEnd(bidsReceived: prebidjs.BidResponse[]): void;
  getLastBidCpms(adUnitCode: string): number[] | null;
}

export const createPreviousBidCpms = (): PreviousBidCpms => {
  const lastBidCpms: Map<string, number[]> = new Map();

  const groupReceivedBidsByAdUnitCode = (
    bidsReceived: prebidjs.BidResponse[]
  ): { [key: string]: number[] } => {
    return bidsReceived.reduce((result, current) => {
      const { adUnitCode, cpm } = current;
      if (!result[adUnitCode]) {
        result[adUnitCode] = [];
      }
      result[adUnitCode].push(cpm);
      return result;
    }, {});
  };

  const onAuctionEnd = (bidsReceived: prebidjs.BidResponse[]): void => {
    const bidsOfLastAuction = groupReceivedBidsByAdUnitCode(bidsReceived);

    lastBidCpms.forEach((_, key) => {
      if (!bidsOfLastAuction[key]) {
        lastBidCpms.delete(key);
      }
    });

    Object.entries(bidsOfLastAuction).forEach(([adUnitCode, cpmsOfLastAuction]) => {
      const earlierCpmsOnPosition = getLastBidCpms(adUnitCode) ?? [];
      lastBidCpms.set(
        adUnitCode,
        Array.from(new Set([...cpmsOfLastAuction, ...earlierCpmsOnPosition]))
      );
    });
  };

  const getLastBidCpms = (adUnitCode: string): number[] | null => {
    return lastBidCpms.get(adUnitCode) ?? null;
  };

  return {
    groupReceivedBidsByAdUnitCode,
    onAuctionEnd,
    getLastBidCpms
  };
};
