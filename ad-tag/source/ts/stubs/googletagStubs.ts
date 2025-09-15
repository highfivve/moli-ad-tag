import { googletag } from '../types/googletag';

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
    refresh: (_slots?: googletag.IAdSlot[], _options?: { changeCorrelator: boolean }): void => {
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
    removeEventListener: (_eventType: string, _listener: (event: any) => void) => {
      return false;
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

export const googleAdSlotStub = (adUnitPath: string, slotId: string): googletag.IAdSlot => {
  let targetingMap: Record<string, string[]> = {};
  const stub: googletag.IAdSlot = {
    clearTargeting(key?: string): void {
      if (key) {
        delete targetingMap[key];
      } else {
        targetingMap = {};
      }
      return;
    },
    setTargeting: (key: string, value: string | string[]): googletag.IAdSlot => {
      if (typeof value === 'string') {
        targetingMap[key] = [value];
      } else {
        targetingMap[key] = value;
      }
      return stub;
    },
    getTargeting: (key: string): string[] => {
      return targetingMap[key] || [];
    },
    getTargetingKeys(): string[] {
      return Object.keys(targetingMap);
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
    },
    getResponseInformation: (): googletag.IResponseInformation | null => {
      return null;
    },
    setConfig(_config: googletag.GptSlotSettingsConfig) {
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
    setConfig: (): void => {
      return;
    }
  };
};
