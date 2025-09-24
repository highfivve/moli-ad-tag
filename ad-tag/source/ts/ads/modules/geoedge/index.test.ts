import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AdPipelineContext, InitStep } from '../../adPipeline';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { geoEdge } from 'ad-tag/ads/modules/geoedge/index';
import { modules } from 'ad-tag/types/moliConfig';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';

use(sinonChai);

describe('GeoEdge Module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();

  beforeEach(() => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    jsDomWindow.googletag = createGoogletagStub();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  const publisherKey = 'abc123';

  const createAndConfigureModule = (
    key: string,
    cfg?: modules.geoedge.GeoEdgeConfig,
    checkGVLID?: boolean
  ) => {
    const module = geoEdge();
    module.configure__({
      geoedge: {
        key: key,
        enabled: true,
        cfg: cfg,
        checkGVLID
      }
    });
    return { module, initStep: module.initSteps__()[0] };
  };

  const testGeoEdgeLoad = async (
    initStep: InitStep,
    context: AdPipelineContext,
    shouldLoad: boolean
  ) => {
    const loadScriptStub = sandbox
      .stub(context.assetLoaderService__, 'loadScript')
      .returns(Promise.resolve());

    await initStep(context);

    if (shouldLoad) {
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'geoedge',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${publisherKey}/grumi-ip.js`
      });
    } else {
      expect(loadScriptStub).to.have.not.been.called;
    }
  };

  it('should add an init step', async () => {
    const { module } = createAndConfigureModule(publisherKey);
    const initSteps = module.initSteps__();
    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('geoedge-init');
  });

  describe('load geoedge', () => {
    it('not load anything in a test environment', async () => {
      const { initStep } = createAndConfigureModule(publisherKey);
      await testGeoEdgeLoad(initStep, adPipelineContext(jsDomWindow, { env__: 'test' }), false);
    });

    it('not load anything if gdpr applies, checkGVLID is true and vendor 845 has no consent ', async () => {
      const { initStep } = createAndConfigureModule(publisherKey, undefined, true);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: fullConsent({ 845: false }) }),
        false
      );
    });

    it('load geoedge if gdpr does not apply', async () => {
      const { initStep } = createAndConfigureModule(publisherKey);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: tcDataNoGdpr }),
        true
      );
    });

    it('load geoedge if gdpr applies and relevant consent is available', async () => {
      const { initStep } = createAndConfigureModule(publisherKey);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: fullConsent({ 845: true }) }),
        true
      );
    });

    it('load geoedge if gdpr applies, checkGVLID is unset and purpose 1 is set ', async () => {
      const { initStep } = createAndConfigureModule(publisherKey);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: fullConsent({ 845: false }) }),
        true
      );
    });

    it('load geoedge if gdpr applies, checkGVLID is false and purpose 1 is set ', async () => {
      const { initStep } = createAndConfigureModule(publisherKey, undefined, false);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: fullConsent({ 845: false }) }),
        true
      );
    });
  });

  describe('geoedge config', () => {
    it('should set grumi config on window', async () => {
      const cfg: modules.geoedge.GeoEdgeConfig = { advs: { '123': true } };
      const { initStep } = createAndConfigureModule(publisherKey, cfg);
      await testGeoEdgeLoad(
        initStep,
        adPipelineContext(jsDomWindow, { tcData__: tcDataNoGdpr }),
        true
      );
      expect(jsDomWindow.grumi).to.deep.eq({ key: publisherKey, cfg: cfg });
    });
  });
});
