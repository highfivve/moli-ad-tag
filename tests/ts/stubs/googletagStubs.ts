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

export const googleAdSlotStub: googletag.IAdSlot = {
  setTargeting: (_key: string, _value: string | string[]): googletag.IAdSlot => { return googleAdSlotStub; },
  getTargeting: (_key: string): string[] => { return []; },
  setCollapseEmptyDiv: (_doCollapse: boolean, _collapseBeforeAdFetch: boolean): void => { return; },
  getSlotElementId: () => { throw new Error('stub getSlotElementID'); },
  getAdUnitPath: () => { throw new Error('stub getAdUnitPath'); },
  addService: (_service: googletag.IService<any>): void => { return; }
};

export const googletagStub: googletag.IGoogleTag = {
  cmd: {
    // execute every callback instantly
    push: (callback: Function) => { callback(); }
  },
  defineSlot: (_adUnitPath: string, _size: googletag.Size[], _slotId: string): googletag.IAdSlot => { return googleAdSlotStub; },
  defineOutOfPageSlot: (_adUnitPath: string, _slotId: string): googletag.IAdSlot => { return googleAdSlotStub; },
  destroySlots: (_opt_slots: googletag.IAdSlot[]): void => { return; },
  display: (_id: string): void => { return; },
  enableServices: (): void => { return; },
  pubads: (): googletag.IPubAdsService => pubAdsServiceStub
};
