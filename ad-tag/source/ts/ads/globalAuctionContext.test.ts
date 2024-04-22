import sinon, { SinonSandbox } from 'sinon';
import { AdService } from './adService';
import { IAdPipelineConfiguration } from './adPipeline';
import { Moli } from '../types/moli';
import { emptyConfig } from '../stubs/moliStubs';
import { expect } from 'chai';
import { createDom } from '../stubs/browserEnvSetup';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';

describe('Global action', () => {
  let dom = createDom();
  let jsDomWindow: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow =
    dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);

  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    // Restore any stubs/spies
    sandbox.restore();
  });

  const makeAdService = (): AdService => {
    const adPipelineConfiguration: IAdPipelineConfiguration = {
      init: [],
      configure: [],
      defineSlots: () => Promise.resolve([]),
      prepareRequestAds: [],
      requestBids: [],
      requestAds: () => Promise.resolve()
    };
    return new AdService(assetLoaderService, jsDomWindow, adPipelineConfiguration);
  };

  it("shouldn't instantiate auction in adPipeline by default config", async () => {
    const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
      ...emptyConfig,
      globalAuctionContext: undefined
    };
    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.undefined;
  });

  it("instantiated adPipeline shouldn't hold auction context if it was disabled in config", async () => {
    const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
      ...emptyConfig,
      globalAuctionContext: {
        biddersDisabling: { enabled: false, minRate: 0, minBidRequests: 0, deactivationTTL: 0 }
      }
    };

    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.undefined;
  });

  it('should instantiate auction in adPipeline if it was enabled in config', async () => {
    const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
      ...emptyConfig,
      globalAuctionContext: {
        biddersDisabling: {
          enabled: true,
          minRate: 0.5,
          minBidRequests: 10,
          deactivationTTL: 60000
        }
      }
    };

    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.ok;
  });
});
