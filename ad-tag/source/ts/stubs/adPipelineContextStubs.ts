import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyRuntimeConfig,
  newEmptyConfig,
  newGlobalAuctionContext,
  newNoopLogger,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createLabelConfigService } from 'ad-tag/ads/labelConfigService';

export const adPipelineContext = (
  jsDomWindow: any,
  overrides?: Partial<AdPipelineContext>
): AdPipelineContext => ({
  auctionId__: 'xxxx-xxxx-xxxx-xxxx',
  requestId__: 0,
  requestAdsCalls__: 1,
  env__: 'production',
  logger__: newNoopLogger(),
  config__: newEmptyConfig(),
  runtimeConfig__: emptyRuntimeConfig,
  window__: jsDomWindow,
  // no service dependencies required
  labelConfigService__: createLabelConfigService([], [], jsDomWindow),
  tcData__: fullConsent(),
  adUnitPathVariables__: {},
  auction__: newGlobalAuctionContext(jsDomWindow),
  assetLoaderService__: createAssetLoaderService(jsDomWindow),
  ...overrides
});
