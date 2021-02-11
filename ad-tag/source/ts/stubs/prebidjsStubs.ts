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
        requestParam.bidsBackHandler({}, false);
      }
    },
    setConfig: (_config: prebidjs.IPrebidJsConfig): void => {
      return;
    },
    setTargetingForGPTAsync: (_adUnits: string[]): void => {
      return;
    },
    triggerUserSyncs(): void {
      return;
    },
    enableAnalytics(_: prebidjs.analytics.AnalyticsAdapter[]): void {
      return;
    },
    onEvent(_event: prebidjs.event.EventName, _handler: Function, _id?: any): void {
      return;
    },
    offEvent(_event: prebidjs.event.EventName, _handler: Function, _id?: any): void {
      return;
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
  }
};
