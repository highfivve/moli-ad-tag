import { googletag } from '../../../source/ts/types/googletag';

const createPubAdsServiceStub = (): googletag.IPubAdsService => {
  const stub = {
    set: (_key: string, _value: string): googletag.IPubAdsService => {
      return stub;
    },
    setTargeting: (_key: string, _value: string | string[]): googletag.IPubAdsService => {
      return stub;
    },
    setRequestNonPersonalizedAds: (_value: 0 | 1): googletag.IPubAdsService => {
      return stub;
    },
    clearTargeting: (_: string): googletag.IPubAdsService => {
      return stub;
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
    addEventListener: (
      _eventType: string,
      _listener: (event: any) => void
    ): googletag.IPubAdsService => {
      return stub;
    },
    setPrivacySettings: (_options: googletag.IPrivacySettingsConfig): googletag.IPubAdsService => {
      return stub;
    },
    setCookieOptions: (): googletag.IPubAdsService => {
      return stub;
    }
  };

  return stub;
};

export const contentServiceStub: googletag.IContentService = {
  getSlots: (): googletag.IAdSlot[] => {
    return [];
  },
  addEventListener: (
    _eventType: string,
    _listener: (event: any) => void
  ): googletag.IContentService => {
    return contentServiceStub;
  },
  setContent(slot: googletag.IAdSlot, content: string): void {
    return;
  }
};

export const googleAdSlotStub = (adUnitPath: string, slotId: string): googletag.IAdSlot => {
  const stub: googletag.IAdSlot = {
    clearTargeting(_key?: string): void {
      return;
    },
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

export const createGoogletagStub = (): googletag.IGoogleTag => {
  const pubAdsStub = createPubAdsServiceStub();

  return {
    pubadsReady: true,
    cmd: {
      // execute every callback instantly
      push: (callback: Function) => {
        callback();
      }
    },
    enums: {
      OutOfPageFormat: {
        TOP_ANCHOR: 2,
        BOTTOM_ANCHOR: 3,
        REWARDED: 4,
        INTERSTITIAL: 5
      }
    },
    defineSlot: (
      adUnitPath: string,
      _size: googletag.Size[],
      slotId: string
    ): googletag.IAdSlot => {
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
    pubads: (): googletag.IPubAdsService => pubAdsStub,
    content: (): googletag.IContentService => contentServiceStub
  };
};
