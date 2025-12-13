import { googletag } from 'ad-tag/types/googletag';

export type AnalyticsSession = {
  getId: () => string;
};

export type AnalyticsSessionStore = {
  id: string;
  createdAt: number;
  lastActivityAt: number;
};

export type EventTracker = {
  track: (event: Event) => void;
};

export namespace Events {
  export type AnalyticsLabels = null | {
    ab_test: string | null;
    variant: string | null;
  };

  export type UTMParams = {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };

  type Data = {
    analyticsLabels: AnalyticsLabels;
    [key: string]: any;
  };

  type Payload = {
    timestamp: string;
    data: Data;
  };

  type BaseEvent = {
    v: number;
    type: string;
    publisher: string;
    timestamp: number;
    payload: Payload;
  };

  export namespace Prebid {
    export type AuctionEnd = BaseEvent & {
      type: 'prebid.auctionEnd';
      payload: {
        data: {
          auctionId: string;
          adUnits: {
            code: string;
            transactionId: string;
            adUnitName?: string;
          }[];
          bidderRequests: {
            bidderCode: string;
            auctionId: string;
            bids: {
              bidder: string;
              adUnitCode: string;
              sizes: [number, number][];
              bidId: string;
            }[];
            ortb2: {
              device: {
                ua: string;
                sua: Record<string, any> | null;
              };
            };
          }[];
          bidsReceived: {
            bidder: string;
            adUnitCode: string;
            requestId: string;
            transactionId: string;
            currency: string;
            cpm: number;
            size: string;
            timeToRespond: number;
          }[];
        };
      };
    };

    export type BidWon = BaseEvent & {
      type: 'prebid.bidWon';
      payload: {
        data: {
          bidderCode: string;
          auctionId: string;
          adUnitCode: string;
          transactionId: string;
          requestId: string;
          currency: string;
          cpm: number;
          size: string;
          status: string;
          timeToRespond: number;
        };
      };
    };
  }

  export namespace GPT {
    export type SlotRenderEnded = BaseEvent & {
      type: 'gpt.slotRenderEnded';
      payload: {
        data: {
          adUnitPath: string;
          isEmpty: boolean;
          size: googletag.Size;
          sessionId: string;
          pageViewId: string;
        };
        // TODO: complete prebid ref
        prebidRef: {
          auctionId: string;
        };
      };
    };
  }

  export namespace Page {
    export type View = BaseEvent & {
      type: 'page.view';
      payload: {
        data: {
          sessionId: string;
          pageViewId: string;
          domain: string;
          ua: string;
          utm: UTMParams;
        };
      };
    };
  }
}

export type Event =
  | Events.Prebid.AuctionEnd
  | Events.Prebid.BidWon
  | Events.GPT.SlotRenderEnded
  | Events.Page.View;
