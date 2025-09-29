import {
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag,
  prebidjs,
  Moli,
  apstag,
  tcfapi
} from '@highfivve/ad-tag';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GeoEdge, GeoEdgeConfig } from './index';
import { newEmptyConfig, newNoopLogger, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';
import { EventService } from '@highfivve/ad-tag/lib/ads/eventService';

use(sinonChai);

describe('GeoEdge Module', () => {
  const createDomAndWindow = () => {
    const dom = createDom();
    return {
      dom,
      jsDomWindow: dom.window as any as Window &
        googletag.IGoogleTagWindow &
        apstag.WindowA9 &
        prebidjs.IPrebidjsWindow &
        tcfapi.TCFApiWindow &
        Moli.MoliWindow &
        Pick<typeof globalThis, 'Date' | 'console'>
    };
  };

  const adPipelineContext = (
    jsDomWindow: any,
    overrides?: Partial<AdPipelineContext>
  ): AdPipelineContext => ({
    requestId: 0,
    requestAdsCalls: 1,
    env: 'production',
    logger: newNoopLogger(),
    config: newEmptyConfig(),
    window: jsDomWindow,
    // no service dependencies required
    labelConfigService: null as any,
    reportingService: null as any,
    tcData: fullConsent(),
    adUnitPathVariables: {},
    auction: new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService()),
    ...overrides
  });
  let jsDomWindow = createDomAndWindow().jsDomWindow;

  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  const publisherKey = 'abc123';

  const createModule = (key: string, cfg?: GeoEdgeConfig, checkGVLID?: boolean): GeoEdge => {
    return new GeoEdge({ key, cfg, checkGVLID });
  };

  it('should add an init step', async () => {
    const module = createModule(publisherKey);
    const config = newEmptyConfig();
    module.init(config, assetLoaderService);
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('geoedge');
  });

  describe('load geoedge', () => {
    it('should not load anything in a test environment', async () => {
      const module = createModule(publisherKey);
      await module.loadGeoEdge(adPipelineContext(jsDomWindow, { env: 'test' }), assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('should not load anything if gdpr applies, checkGVLID is true and vendor 845 has no consent ', async () => {
      const module = createModule(publisherKey, undefined, true);
      await module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: fullConsent({ 845: false }) }),
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('should load geoedge if gdpr does not apply', () => {
      const module = createModule(publisherKey);
      module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: tcDataNoGdpr }),
        assetLoaderService
      );
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
    });

    it('should load geoedge if gdpr applies and relevant consent is available', async () => {
      const module = createModule(publisherKey);
      await module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: fullConsent({ 845: true }) }),
        assetLoaderService
      );

      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
    });

    it('should load geoedge if gdpr applies, checkGVLID is unset and purpose 1 is set ', async () => {
      const module = createModule(publisherKey);
      await module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: fullConsent({ 845: false }) }),
        assetLoaderService
      );

      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
    });

    it('should load geoedge if gdpr applies, checkGVLID is false and purpose 1 is set ', async () => {
      const module = createModule(publisherKey, undefined, false);
      await module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: fullConsent({ 845: false }) }),
        assetLoaderService
      );

      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
    });
  });

  describe('geoedge config', () => {
    it('should set grumi config on window', async () => {
      const cfg: GeoEdgeConfig = { advs: { '123': true } };
      const module = createModule(publisherKey, cfg);

      await module.loadGeoEdge(
        adPipelineContext(jsDomWindow, { tcData: tcDataNoGdpr }),
        assetLoaderService
      );
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
      expect(jsDomWindow.grumi).to.deep.eq({ key: publisherKey, cfg: cfg });
    });
  });
});
