import type { Device } from 'ad-tag/types/moliConfig';

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
            adUnitName: string;
          }[];
          bidderRequests: {
            bidderCode: string;
            auctionId: string;
            bids: {
              adUnitCode: string;
            }[];
            ortb2: {
              device: {
                ua: string;
              };
            };
          }[];
          bidsReceived: {
            bidder: string;
            adUnitCode: string;
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
          auctionId: string;
          bidderCode: string;
          adUnitCode: string;
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
          sessionId: string;
          pageViewId: string;
          auctionId: string;
          userId?: string;
          adUnitPath: string;
          adUnitCode: string;
          adUnitName: string;
          isEmpty: boolean;
          size: string;
          device: Device;
          domain: string;
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
          device: Device;
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
