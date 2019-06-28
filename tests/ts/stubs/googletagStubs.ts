import { googletag } from '../../../source/ts/types/googletag';

export const pubAdsServiceStub: googletag.IPubAdsService = {
  set: (_key: string, _value: string): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  },
  setTargeting: (_key: string, _value: string | string[]): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  },
  setRequestNonPersonalizedAds: (_value: 0 | 1): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  },
  refresh: (slots?: googletag.IAdSlot[], options?: { changeCorrelator: boolean }): void => {
    return;
  },
  enableSingleRequest: (): boolean => {
    return true;
  },
  enableAsyncRendering: (): boolean => {
    return true;
  },
  disableInitialLoad: (): void => {
    return;
  },
  getSlots: (): googletag.IAdSlot[] => {
    return [];
  },
  addEventListener: (_eventType: string, _listener: (event: any) => void): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  }
};

export const contentServiceStub: googletag.IContentService = {
  getSlots: (): googletag.IAdSlot[] => {
    return [];
  },
  addEventListener: (_eventType: string, _listener: (event: any) => void): googletag.IContentService => {
    return contentServiceStub;
  },
  setContent(slot: googletag.IAdSlot, content: string): void {
    return;
  }
};

export const googleAdSlotStub = (adUnitPath: string, slotId: string): googletag.IAdSlot => {

  const stub: googletag.IAdSlot = {
    setTargeting: (_key: string, _value: string | string[]): googletag.IAdSlot => {
      return stub;
    },
    getTargeting: (_key: string): string[] => {
      return [];
    },
    setCollapseEmptyDiv: (_doCollapse: boolean, _collapseBeforeAdFetch: boolean): void => {
      return;
    },
    getSlotElementId: () => {
      return slotId;
    },
    getAdUnitPath: () => {
      return adUnitPath;
    },
    addService: (_service: googletag.IService<any>): void => {
      return;
    }
  };
  return stub;
};

export const googletagStub: googletag.IGoogleTag = {
    pubadsReady: true,
    cmd: {
      // execute every callback instantly
      push: (callback: Function) => {
        callback();
      }
    },
    defineSlot: (adUnitPath: string, _size: googletag.Size[], slotId: string): googletag.IAdSlot => {
      return googleAdSlotStub(adUnitPath, slotId);
    },
    defineOutOfPageSlot: (adUnitPath: string, slotId: string): googletag.IAdSlot => {
      return googleAdSlotStub(adUnitPath, slotId);
    },
    destroySlots: (_opt_slots: googletag.IAdSlot[]): void => {
      return;
    },
    display: (_id: string): void => {
      return;
    },
    enableServices: (): void => {
      return;
    },
    pubads: (): googletag.IPubAdsService => pubAdsServiceStub,
    content: (): googletag.IContentService => contentServiceStub
  };
