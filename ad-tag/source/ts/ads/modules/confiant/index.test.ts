import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AdPipelineContext } from '../../adPipeline';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { Confiant } from 'ad-tag/ads/modules/confiant/index';
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { tcfapi } from 'ad-tag/types/tcfapi';
import TCData = tcfapi.responses.TCData;

use(sinonChai);

describe('Confiant Module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();
  let assetLoaderService = createAssetLoaderService(jsDomWindow);

  const setupDomAndServices = () => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    jsDomWindow.googletag = createGoogletagStub();
    assetLoaderService = createAssetLoaderService(jsDomWindow);
  };

  const modulesConfig = (checkGVLID?: boolean): { confiant: modules.confiant.ConfiantConfig } => ({
    confiant: {
      enabled: true,
      assetUrl: 'http://localhost/confiant.js',
      checkGVLID
    }
  });

  const adPipelineContext = (
    tcData?: TCData,
    targeting?: googleAdManager.Targeting
  ): AdPipelineContext => ({
    auctionId__: 'xxxx-xxxx-xxxx-xxxx',
    requestId__: 0,
    requestAdsCalls__: 1,
    env__: 'production',
    logger__: noopLogger,
    config__: { ...emptyConfig, targeting: targeting },
    runtimeConfig__: emptyRuntimeConfig,
    window__: jsDomWindow,
    labelConfigService__: null as any,
    tcData__: tcData ?? fullConsent({ '44': true }),
    adUnitPathVariables__: {},
    auction__: newGlobalAuctionContext(jsDomWindow),
    assetLoaderService__: assetLoaderService
  });

  beforeEach(() => {
    setupDomAndServices();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  const createAndConfigureModule = (checkGVLID?: boolean) => {
    const module = new Confiant();
    module.configure__(modulesConfig(checkGVLID));
    return module;
  };

  const testConfiantLoad = async (
    module: Confiant,
    context: AdPipelineContext,
    shouldLoad: boolean
  ) => {
    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const init = module.initSteps__()[0];
    expect(init).to.be.ok;

    await init(context);

    if (shouldLoad) {
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/confiant.js'
      });
    } else {
      expect(loadScriptStub).to.have.not.been.called;
    }
  };

  it('should add an init step', async () => {
    const module = createAndConfigureModule();
    const initSteps = module.initSteps__();
    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('confiant-init');
  });

  describe('loadConfiant', () => {
    it('not load anything in a test environment', async () => {
      const module = createAndConfigureModule();
      await testConfiantLoad(module, { ...adPipelineContext(), env__: 'test' }, false);
    });

    it('not load anything if gdpr applies, vendor 56 has no consent and checkGVLID is true', async () => {
      const module = createAndConfigureModule(true);
      await testConfiantLoad(module, adPipelineContext(fullConsent({ 56: false })), false);
    });

    it('not load anything if gdpr applies, vendor 56 has no consent and checkGVLID is unset', async () => {
      const module = createAndConfigureModule();
      const tcDataFullConsent = fullConsent({ 56: true });
      await testConfiantLoad(
        module,
        adPipelineContext({
          ...tcDataFullConsent,
          purpose: {
            ...tcDataFullConsent.purpose,
            consents: { ...tcDataFullConsent.purpose.consents, 1: false }
          }
        }),
        false
      );
    });

    it('load confiant if gdpr does not apply', async () => {
      const module = createAndConfigureModule();
      await testConfiantLoad(module, { ...adPipelineContext(), tcData__: tcDataNoGdpr }, true);
    });

    it('load confiant if gdpr does apply', async () => {
      const module = createAndConfigureModule();
      await testConfiantLoad(module, adPipelineContext(), true);
    });

    it('load confiant if gdpr does apply, vendor 56 has no consent and checkGVLID is unset', async () => {
      const module = createAndConfigureModule();
      await testConfiantLoad(module, adPipelineContext(fullConsent({ 56: false })), true);
    });

    it('load confiant if gdpr does apply, vendor 56 has no consent and checkGVLID is set to false', async () => {
      const module = createAndConfigureModule(false);
      await testConfiantLoad(module, adPipelineContext(fullConsent({ 56: false })), true);
    });
  });
});
