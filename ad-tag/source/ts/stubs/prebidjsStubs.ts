import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';

export const createPbjsStub = (): prebidjs.IPrebidJs => {
  return {
    que: {
      // execute every callback instantly
      push: (callback: Function) => {
        callback();
      }
    },
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
    getHighestCpmBids(adUnitCode?: string): prebidjs.event.BidResponse[] {
      return [];
    },
    renderAd(iframeDocument: Document, adId: string): void {
      return;
    },
    registerSignalSources(): void {
      return;
    },
    getAllWinningBids(): prebidjs.event.BidResponse[] {
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

export const moliPrebidTestConfig: Moli.headerbidding.PrebidConfig = {
  config: pbjsTestConfig,
  distributionUrls: {
    es6: 'cdn.h5v.eu/prebid.js/build/dist1_es6_78/Prebid.js/build/dist/prebid.js?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=OQVKDH6RSRHZPWO8QNJ1%2F20240606%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240606T152055Z&X-Amz-Expires=604800&X-Amz-Security-Token=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NLZXkiOiJPUVZLREg2UlNSSFpQV084UU5KMSIsImV4cCI6MTcxNzcyNTM4MSwicGFyZW50IjoiamVua2lucyJ9.-MoMIkxI89GPZt2NK_ZJDBduoK8nl74djxa_4rh9VoGn8n3ugrg6p4FWgtkmflHIIOMYeiIUEFjBwHIZq7C--g&X-Amz-SignedHeaders=host&versionId=8b815343-515c-434d-a166-ce011181c174&X-Amz-Signature=19cd11fa12307c8633852f67b973b9c7a9a738a79cffa3e0c361e5f7d63653a8'
  },
  schain: {
    nodes: []
  }
};
