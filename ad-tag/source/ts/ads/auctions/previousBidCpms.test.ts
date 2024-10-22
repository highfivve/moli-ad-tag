import { expect } from 'chai';
import { PreviousBidCpms } from './previousBidCpms';
import { prebidjs } from '../../types/prebidjs';
import BidResponse = prebidjs.BidResponse;

describe('PreviousBidCpms', () => {
  let dynamicFloorPrices: PreviousBidCpms;
  const exampleResponse: BidResponse = {
    bidder: 'criteo',
    meta: {},
    adId: 'ad123',
    requestId: 'req123',
    mediaType: 'banner',
    source: 'client',
    cpm: 1.5,
    creativeId: 456,
    currency: 'USD',
    originalCurrency: 'USD',
    netRevenue: true,
    adUnitCode: 'unit123',
    ad: '<div>Ad content</div>',
    auctionId: 'auction123',
    responseTimestamp: Date.now(),
    requestTimestamp: Date.now() - 100,
    timeToRespond: 100,
    pbLg: '1.50',
    pbMg: '1.50',
    pbHg: '1.50',
    pbAg: '1.50',
    pbDg: '1.50',
    pbCg: '1.50',
    size: '300x250',
    adserverTargeting: {
      hb_bidder: 'exampleBidder',
      hb_adid: 'ad123',
      hb_pb: '1.50',
      hb_size: '300x250',
      hb_source: 'client',
      hb_format: 'banner',
      hb_adomain: 'example.com'
    },
    statusMessage: 'Bid available',
    native: {}
  };

  beforeEach(() => {
    dynamicFloorPrices = new PreviousBidCpms();
  });

  describe('groupReceivedBidsByAdUnitCode', () => {
    it('should group bid responses by adUnitCode', () => {
      const bidsReceived: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.0 },
        { ...exampleResponse, adUnitCode: 'content_2', cpm: 3.0 }
      ];

      const groupedBids = dynamicFloorPrices.groupReceivedBidsByAdUnitCode(bidsReceived);

      expect(groupedBids).to.deep.equal({
        content_1: [1.5, 2.0],
        content_2: [3.0]
      });
    });
    it('should return an empty object if no bids are received', () => {
      const groupedBids = dynamicFloorPrices.groupReceivedBidsByAdUnitCode([]);

      expect(groupedBids).to.deep.equal({});
    });
  });

  describe('onAuctionEnd', () => {
    it('should persist the last bid cpms by adUnitCode', () => {
      const bidsReceived: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.0 },
        { ...exampleResponse, adUnitCode: 'content_2', cpm: 3.0 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.1 }
      ];

      dynamicFloorPrices.onAuctionEnd(bidsReceived);

      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.deep.equal([1.5, 2.0, 2.1]);
      expect(dynamicFloorPrices.getLastBidCpms('content_2')).to.deep.equal([3.0]);
    });
    it('should persist all previous bid cpms for a given adUnitCode, also after an ad reload', () => {
      const bidsReceived1: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.0 }
      ];

      const bidsReceived2: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 3.0 },
        { ...exampleResponse, adUnitCode: 'content_3', cpm: 1.0 }
      ];

      dynamicFloorPrices.onAuctionEnd(bidsReceived1);
      dynamicFloorPrices.onAuctionEnd(bidsReceived2);

      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.have.members([1.5, 2.0, 3.0]);
      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.have.length(3);
      expect(dynamicFloorPrices.getLastBidCpms('content_3')).to.have.members([1.0]);
      expect(dynamicFloorPrices.getLastBidCpms('content_3')).to.have.length(1);
    });
    it('should persist only unique values', () => {
      const bidsReceived1: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.0 }
      ];

      const bidsReceived2: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 3.0 }
      ];

      dynamicFloorPrices.onAuctionEnd(bidsReceived1);
      dynamicFloorPrices.onAuctionEnd(bidsReceived2);

      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.have.members([1.5, 2.0, 3.0]);
      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.have.length(3);
    });
    it('should delete the previousCpms of the adUnitCode, if there were no bids afterwards', () => {
      const bidsReceived1: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 10.0 }
      ];

      const bidsReceived2: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_2', cpm: 3.0 }
      ];

      dynamicFloorPrices.onAuctionEnd(bidsReceived1);
      dynamicFloorPrices.onAuctionEnd(bidsReceived2);

      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.be.null;
      expect(dynamicFloorPrices.getLastBidCpms('content_2')).to.have.members([3.0]);
    });
    it('should handle empty bids received', () => {
      dynamicFloorPrices.onAuctionEnd([]);
      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.be.null;
    });
  });

  describe('getLastBidCpms', () => {
    it('should return the last bid cpms for a given adUnitCode', () => {
      const bidsReceived: BidResponse[] = [
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 1.5 },
        { ...exampleResponse, adUnitCode: 'content_1', cpm: 2.0 }
      ];

      dynamicFloorPrices.onAuctionEnd(bidsReceived);

      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.deep.equal([1.5, 2.0]);
    });
    it('should return null if no bids are stored for the given adUnitCode', () => {
      expect(dynamicFloorPrices.getLastBidCpms('content_1')).to.be.null;
    });
  });
});
