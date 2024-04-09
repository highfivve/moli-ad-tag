import { GlobalAuctionContext } from './globalAuctionContext';
import sinon, { SinonSandbox } from 'sinon';
import { AdService } from './adService';
import { IAdPipelineConfiguration } from './adPipeline';
import { Moli } from '../types/moli';
import { emptyConfig } from '../stubs/moliStubs';
import { expect } from 'chai';
import { createDom } from '../stubs/browserEnvSetup';
import { createAssetLoaderService } from '../util/assetLoaderService';

describe('Global action', () => {
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);

  let globalAuctionContext: GlobalAuctionContext;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    globalAuctionContext = new GlobalAuctionContext({ enabled: true });
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
      globalAuctionContext: new GlobalAuctionContext()
    };
    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.undefined;
  });

  it("instantiated adPipeline shouldn't hold auction context if it was disabled in config", async () => {
    const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
      ...emptyConfig,
      globalAuctionContext: { enabled: false }
    };

    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.undefined;
  });

  it('should instantiate auction in adPipeline if it was enabled in config', async () => {
    const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
      ...emptyConfig,
      globalAuctionContext: globalAuctionContext
    };

    const adService = makeAdService();
    await adService.initialize(emptyConfigWithGlobalAuction, true);
    expect(adService.getAdPipeline().getAuction()).to.be.ok;
  });

  // Todo add more tests for GlobalAuctionContext
});
