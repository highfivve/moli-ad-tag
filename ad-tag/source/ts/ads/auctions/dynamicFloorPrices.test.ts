import { expect } from 'chai';
import { DynamicFloorPrices } from './dynamicFloorPrices';
import { prebidjs } from '../../types/prebidjs';
import BidResponse = prebidjs.event.BidResponse;

describe('DynamicFloorPrices', () => {
  let dynamicFloorPrices: DynamicFloorPrices;
  const exampleResponse: BidResponse = {
    bidder: 'criteo',
    bidderCode: 'criteo',
    params: [],
    meta: {},
    adId: 'ad123',
    requestId: 'req123',
    mediaType: 'banner',
    source: 'client',
    cpm: 1.5,
    creativeId: 456,
    currency: 'USD',
    netRevenue: true,
    ttl: 300,
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
    status: 'rendered',
    statusMessage: 'Bid available',
    native: {
      address: '123 Example St',
      body: 'This is the body text',
      body2: 'This is the secondary body text',
      cta: 'Click here',
      clickTrackers: ['http://example.com/click1', 'http://example.com/click2'],
      clickUrl: 'http://example.com/click',
      displayUrl: 'http://example.com/display',
      downloads: '1000',
      image: {
        url: 'http://example.com/image.jpg',
        height: 250,
        width: 300
      }
    }
  };

  beforeEach(() => {
    dynamicFloorPrices = new DynamicFloorPrices();
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
    it('should store the last bid cpms by adUnitCode', () => {
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

    it('should handle empty bids received', () => {
      dynamicFloorPrices.onAuctionEnd([]);

      expect(dynamicFloorPrices.getLastBidCpms('unit1')).to.be.null;
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
