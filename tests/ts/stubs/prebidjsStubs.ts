import { prebidjs } from '../../../source/ts/types/prebidjs';

export const pbjsStub: prebidjs.IPrebidJs = {
  que: {
    // execute every callback instantly
    push: (callback: Function) => { callback(); }
  },
  version: 'none',
  addAdUnits: (_adUnits: prebidjs.IAdUnit[]): void => { return; },
  adserverRequestSent: false,
  bidderSettings: {},
  getAdserverTargeting: (): Object => { return {}; },
  requestBids: (requestParam?: prebidjs.IRequestObj): void => {
    // invoke bidsBackHandler immediately
    if (requestParam && requestParam.bidsBackHandler) {
      requestParam.bidsBackHandler({}, false);
    }
  },
  setConfig: (_config: prebidjs.IPrebidJsConfig): void => { return; },
  setTargetingForGPTAsync: (_adUnits: string[]): void => { return; }
};


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
