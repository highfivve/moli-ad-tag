import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AdPipelineContext } from '../../adPipeline';
import { GlobalAuctionContext } from '../../globalAuctionContext';
import { AssetLoadMethod, createAssetLoaderService } from '../../../util/assetLoaderService';
import { createDom } from '../../../stubs/browserEnvSetup';
import { googletag } from '../../../types/googletag';
import { emptyConfig, emptyRuntimeConfig, noopLogger } from '../../../stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from '../../../stubs/consentStubs';
import { Confiant } from '../../../ads/modules/confiant/index';
import { modules, Targeting } from '../../../types/moliConfig';
import { createGoogletagStub } from '../../../stubs/googletagStubs';
import { tcfapi } from '../../../types/tcfapi';
import TCData = tcfapi.responses.TCData;

use(sinonChai);

describe('Confiant Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom, assetLoaderService;
  let jsDomWindow: Window & googletag.IGoogleTagWindow;

  const setupDomAndServices = () => {
    dom = createDom();
    jsDomWindow = dom.window as any;
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

  const adPipelineContext = (tcData?: TCData, targeting?: Targeting): AdPipelineContext => ({
    requestId: 0,
    requestAdsCalls: 1,
    env: 'production',
    logger: noopLogger,
    config: { ...emptyConfig, targeting: targeting },
    runtimeConfig: emptyRuntimeConfig,
    window: jsDomWindow as any,
    labelConfigService: null as any,
    tcData: tcData ?? fullConsent({ '44': true }),
    adUnitPathVariables: {},
    auction: new GlobalAuctionContext(jsDomWindow as any),
    assetLoaderService: assetLoaderService
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
    module.configure(modulesConfig(checkGVLID));
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

    const init = module.initSteps()[0];
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
    const initSteps = module.initSteps();
    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('confiant-init');
  });

  describe('loadConfiant', () => {
    it('not load anything in a test environment', async () => {
      const module = createAndConfigureModule();
      await testConfiantLoad(module, { ...adPipelineContext(), env: 'test' }, false);
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
      await testConfiantLoad(module, { ...adPipelineContext(), tcData: tcDataNoGdpr }, true);
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
