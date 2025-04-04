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
import { LabelConfigService } from 'ad-tag/ads/labelConfigService';

export const adPipelineContext = (
  jsDomWindow: any,
  overrides?: Partial<AdPipelineContext>
): AdPipelineContext => ({
  auctionId: 'xxxx-xxxx-xxxx-xxxx',
  requestId: 0,
  requestAdsCalls: 1,
  env: 'production',
  logger: newNoopLogger(),
  config: newEmptyConfig(),
  runtimeConfig: emptyRuntimeConfig,
  window: jsDomWindow,
  // no service dependencies required
  labelConfigService: new LabelConfigService([], [], jsDomWindow),
  tcData: fullConsent(),
  adUnitPathVariables: {},
  auction: newGlobalAuctionContext(jsDomWindow),
  assetLoaderService: createAssetLoaderService(jsDomWindow),
  ...overrides
});
