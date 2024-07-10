import { prebidjs } from '../types/prebidjs';
import { headerbidding } from '../types/moliConfig';

export const createPbjsStub = (): prebidjs.IPrebidJs => {
  return {
    que: {
      // execute every callback instantly
      push: (callback: Function) => {
        callback();
      }
    },
    libLoaded: true,
    version: 'none',
    adUnits: [],
    addAdUnits: (_adUnits: prebidjs.IAdUnit[]): void => {
      return;
    },
    removeAdUnit: (_adUnitCode: string): void => {
      return;
    },
    bidderSettings: {},
    getAdserverTargeting: (): Object => {
      return {};
    },
    requestBids: (requestParam?: prebidjs.IRequestObj): void => {
      // invoke bidsBackHandler immediately
      if (requestParam && requestParam.bidsBackHandler) {
        requestParam.bidsBackHandler({}, false, requestParam.auctionId || 'auction-id');
      }
    },
    getConfig: (): prebidjs.IPrebidJsConfig => ({
      currency: {
        adServerCurrency: 'EUR',
        granularityMultiplier: 1,
        defaultRates: { USD: { EUR: 1 } }
      }
    }),
    readConfig: (): prebidjs.IPrebidJsConfig => ({
      currency: {
        adServerCurrency: 'EUR',
        granularityMultiplier: 1,
        defaultRates: { USD: { EUR: 1 } }
      }
    }),
    setConfig: (_config: prebidjs.IPrebidJsConfig): void => {
      return;
    },
    setBidderConfig: (): void => {
      return;
    },
    setTargetingForGPTAsync: (_adUnits: string[]): void => {
      return;
    },
    triggerUserSyncs(): void {
      return;
    },
    getUserIds(): prebidjs.userSync.UserIds {
      return {};
    },
    enableAnalytics(_: prebidjs.analytics.AnalyticsAdapter[]): void {
      return;
    },
    onEvent: () => {
      return;
    },
    offEvent(_event: prebidjs.event.EventName, _handler: Function, _id?: any): void {
      return;
    },
    convertCurrency(cpm: number, fromCurrency: string, toCurrency: string): number {
      // We use an unrealistic value here to easily check the value in tests.
      return cpm * 2;
    },
    getHighestCpmBids(adUnitCode?: string): prebidjs.BidResponse[] {
      return [];
    },
    renderAd(iframeDocument: Document, adId: string): void {
      return;
    },
    registerSignalSources(): void {
      return;
    },
    getAllWinningBids(): prebidjs.BidResponse[] {
      return [];
    }
  };
};

export const pbjsStub: prebidjs.IPrebidJs = createPbjsStub();

export const pbjsTestConfig: prebidjs.IPrebidJsConfig = {
  bidderTimeout: 500,
  currency: {
    adServerCurrency: 'EUR',
    granularityMultiplier: 1,
    defaultRates: {
      USD: {
        EUR: 0.812
      }
    }
  },
  floors: {}
};

export const moliPrebidTestConfig: headerbidding.PrebidConfig = {
  config: pbjsTestConfig,
  distributionUrl: 'https://cdn.h5v.eu/prebid/dist/8.52.0/prebid.js',
  schain: {
    nodes: []
  }
};
