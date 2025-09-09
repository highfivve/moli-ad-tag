import { MoliRuntime } from '../types/moliRuntime';
import { AdSlot, Environment, MoliConfig } from '../types/moliConfig';
import { createGlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { createEventService } from 'ad-tag/ads/eventService';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { createLabelConfigService } from 'ad-tag/ads/labelConfigService';
import { tcData } from 'ad-tag/stubs/consentStubs';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

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
  return createGlobalAuctionContext(jsDomWindow, noopLogger, createEventService());
};

export const newAdPipelineContext = (
  jsDomWindow: any,
  env: Environment = 'production',
  config: MoliConfig = emptyConfig,
  requestAdsCalls: number = 1
): AdPipelineContext => {
  return {
    auctionId__: 'xxxx-xxxx-xxxx-xxxx',
    requestId__: 1,
    requestAdsCalls__: requestAdsCalls,
    env__: env,
    logger__: noopLogger,
    config__: config,
    runtimeConfig__: emptyRuntimeConfig,
    window__: jsDomWindow,
    labelConfigService__: createLabelConfigService([], [], jsDomWindow),
    tcData__: tcData,
    adUnitPathVariables__: { domain: 'example.com', device: 'mobile' },
    auction__: newGlobalAuctionContext(jsDomWindow),
    assetLoaderService__: createAssetLoaderService(jsDomWindow)
  };
};
