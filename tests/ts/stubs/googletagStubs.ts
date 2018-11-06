import { googletag } from '../../../source/ts/types/googletag';

export const pubAdsServiceStub: googletag.IPubAdsService = {
  set: (_key: string, _value: string): googletag.IPubAdsService => { return pubAdsServiceStub; },
  setTargeting: (_key: string, _value: string | string[]): googletag.IPubAdsService => { return pubAdsServiceStub; },
  setRequestNonPersonalizedAds: (_value: 0 | 1): googletag.IPubAdsService => { return pubAdsServiceStub; },
  refresh: (slots?: googletag.IAdSlot[], options?: { changeCorrelator: boolean }): void => { return; },
  enableSingleRequest: (): boolean => { return true; },
  enableAsyncRendering: (): boolean => { return true; },
  disableInitialLoad: (): void => { return; },
  getSlots: (): googletag.IAdSlot[] => { return []; },
  addEventListener: (_eventType: string, _listener: (event: any) => void): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  }
};

export const googletagStub: googletag.IGoogleTag = {
  cmd: {
    // execute every callback instantly
    push: (callback: Function) => { callback(); }
  },
  defineSlot: (_adUnitPath: string, _size: googletag.Size[], _slotId: string): googletag.IAdSlot => { throw new Error('stub'); },
  defineOutOfPageSlot: (_adUnitPath: string, _slotId: string): googletag.IAdSlot => { throw new Error('stub'); },
  destroySlots: (_opt_slots: googletag.IAdSlot[]): void => { return; },
  display: (_id: string): void => { return; },
  enableServices: (): void => { return; },
  pubads: (): googletag.IPubAdsService => pubAdsServiceStub
};