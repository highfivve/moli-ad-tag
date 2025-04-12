import { MoliRuntime } from '../types/moliRuntime';
import { AdSlot, MoliConfig } from '../types/moliConfig';
import { GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { EventService } from 'ad-tag/ads/eventService';

export const newNoopLogger = (withErrorLogs?: boolean): MoliRuntime.MoliLogger => {
  return {
    debug: () => {
      return;
    },
    info: () => {
      return;
    },
    warn: () => {
      return;
    },
    error: (message?: any, ...optionalParams: any[]) => {
      if (withErrorLogs) {
        console.error(message, ...optionalParams);
      }
    }
  };
};

export const noopLogger: MoliRuntime.MoliLogger = newNoopLogger();

export const newEmptyConfig = (slots: AdSlot[] = []): MoliConfig => {
  return {
    slots: slots,
    schain: {
      supplyChainStartNode: {
        asi: 'highfivve.com',
        sid: '1000',
        hp: 1
      }
    }
  };
};

export const newEmptyRuntimeConfig = (): MoliRuntime.MoliRuntimeConfig => ({
  adPipelineConfig: {
    initSteps: [],
    configureSteps: [],
    prepareRequestAdsSteps: [],
    requestBidsSteps: [],
    prebidBidsBackHandler: []
  },
  hooks: {
    beforeRequestAds: [],
    afterRequestAds: []
  },
  labels: [],
  keyValues: {},
  logger: noopLogger,
  adUnitPathVariables: {},
  refreshSlots: [],
  refreshBuckets: [],
  refreshInfiniteSlots: []
});

export const emptyConfig: MoliConfig = newEmptyConfig();

export const emptyRuntimeConfig: MoliRuntime.MoliRuntimeConfig = newEmptyRuntimeConfig();
export const emptyTestRuntimeConfig: MoliRuntime.MoliRuntimeConfig = {
  ...newEmptyRuntimeConfig(),
  environment: 'test'
};

export const newGlobalAuctionContext = (jsDomWindow: any) => {
  return new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService());
};
