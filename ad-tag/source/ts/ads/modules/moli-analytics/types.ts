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
    [key: string]: any;
  };

  type BaseEvent = {
    v: number;
    type: string;
    publisher: string;
    pageViewId: string;
    userId?: string;
    timestamp: number;
    analyticsLabels: AnalyticsLabels;
    data: Data;
  };

  export namespace Prebid {
    export type AuctionEnd = BaseEvent & {
      type: 'prebid.auctionEnd';
      data: {
        auctionId: string;
        adUnits: {
          code: string;
          adUnitName: string;
          gpid: string;
        }[];
        bidderRequests: {
          bidderCode: string;
          bids: {
            adUnitCode: string;
          }[];
        }[];
        bidsReceived: {
          bidder: string;
          adUnitCode: string;
          size: string;
          currency: string;
          cpm: number;
          timeToRespond: number;
        }[];
      };
    };

    export type BidWon = BaseEvent & {
      type: 'prebid.bidWon';
      data: {
        auctionId: string;
        gpid: string;
        bidderCode: string;
        adUnitCode: string;
        size: string;
        currency: string;
        cpm: number;
        status: string;
        timeToRespond: number;
      };
    };
  }

  export namespace GPT {
    export type SlotRenderEnded = BaseEvent & {
      type: 'gpt.slotRenderEnded';
      data: {
        auctionId: string;
        gpid: string;
        adUnitPath: string;
        adUnitCode: string;
        adUnitName: string;
        size: string;
        isEmpty: boolean;
      };
    };
  }

  export namespace Page {
    export type View = BaseEvent & {
      type: 'page.view';
      data: {
        sessionId: string;
        device: Device;
        domain: string;
        ua: string;
        utm: UTMParams;
      };
    };
  }
}

export type Event =
  | Events.Prebid.AuctionEnd
  | Events.Prebid.BidWon
  | Events.GPT.SlotRenderEnded
  | Events.Page.View;

export type EventContext = {
  publisher: string;
  analyticsLabels: Events.AnalyticsLabels;
  session: AnalyticsSession;
  pageViewId: string;
};
