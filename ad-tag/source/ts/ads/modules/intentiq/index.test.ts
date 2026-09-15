import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createIntentIq } from 'ad-tag/ads/modules/intentiq/index';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createPbjsStub, moliPrebidTestConfig } from 'ad-tag/stubs/prebidjsStubs';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { tcfapi } from 'ad-tag/types/tcfapi';

use(sinonChai);

describe('IntentIQ Module', () => {
  const sandbox = Sinon.createSandbox();
  let { dom, jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const intentIqConfig: modules.intentiq.IntentIqModuleConfig = {
    enabled: true,
    partner: 12345
  };

  const prebidConfig: MoliConfig = {
    ...emptyConfig,
    prebid: moliPrebidTestConfig
  };

  const adPipelineContext = (
    tcData: tcfapi.responses.TCData = fullConsent({ 1323: true }),
    config: MoliConfig = prebidConfig
  ): AdPipelineContext => ({
    auctionId__: 'xxxx-xxxx-xxxx-xxxx',
    requestId__: 0,
    requestAdsCalls__: 1,
    env__: 'production',
    logger__: noopLogger,
    config__: config,
    runtimeConfig__: emptyRuntimeConfig,
    window__: jsDomWindow,
    labelConfigService__: null as any,
    tcData__: tcData,
    adUnitPathVariables__: { domain: 'example.com' },
    auction__: newGlobalAuctionContext(jsDomWindow),
    assetLoaderService__: assetLoaderService
  });

  const createModule = (config: modules.intentiq.IntentIqModuleConfig = intentIqConfig) => {
    const module = createIntentIq();
    module.configure__({ intentiq: config });
    return module;
  };

  /** the merged `intentIqId` provider of the first `pbjs.mergeConfig` call */
  const mergedProvider = (
    mergeConfigSpy: Sinon.SinonSpy
  ): prebidjs.userSync.IIntentIqIdProvider => {
    const userIds = mergeConfigSpy.firstCall.args[0].userSync.userIds;
    return userIds[0] as prebidjs.userSync.IIntentIqIdProvider;
  };

  /** the `iiqAnalytics` adapter of the first `pbjs.enableAnalytics` call */
  const enabledAdapter = (
    enableAnalyticsSpy: Sinon.SinonSpy
  ): prebidjs.analytics.IIntentIqAnalyticsAdapter =>
    enableAnalyticsSpy.firstCall.args[0][0] as prebidjs.analytics.IIntentIqAnalyticsAdapter;

  beforeEach(() => {
    jsDomWindow.pbjs = createPbjsStub();
    loadScriptStub.resolves();
  });

  afterEach(() => {
    const result = createDomAndWindow();
    jsDomWindow = result.jsDomWindow;
    dom = result.dom;
    sandbox.reset();
  });

  describe('module configuration', () => {
    it('should not add any steps if the module is not configured', () => {
      const module = createIntentIq();
      module.configure__({});

      expect(module.config__()).to.be.null;
      expect(module.initSteps__()).to.be.empty;
      expect(module.configureSteps__()).to.be.empty;
    });

    it('should not add any steps if the module is disabled', () => {
      const module = createModule({ ...intentIqConfig, enabled: false });

      expect(module.config__()).to.be.null;
      expect(module.initSteps__()).to.be.empty;
      expect(module.configureSteps__()).to.be.empty;
    });

    it('should add an init step and a configure step if enabled', () => {
      const module = createModule();

      expect(module.config__()).to.deep.equal(intentIqConfig);
      expect(module.initSteps__()).to.have.length(1);
      expect(module.initSteps__()[0].name).to.equal('intentiq');
      expect(module.configureSteps__()).to.have.length(1);
      expect(module.configureSteps__()[0].name).to.equal('intentiq-configure');
    });

    it('should use the intentiq config key and the identity module type', () => {
      const module = createIntentIq();
      expect(module.configKey).to.equal('intentiq');
      expect(module.moduleType).to.equal('identity');
    });
  });

  describe('init step', () => {
    it('should not load a script if no scriptUrl is configured', async () => {
      const module = createModule();
      await module.initSteps__()[0](adPipelineContext());

      expect(loadScriptStub).to.have.not.been.called;
    });

    it('should load the configured scriptUrl', async () => {
      const module = createModule({ ...intentIqConfig, scriptUrl: 'https://intentiq.test/tag.js' });
      await module.initSteps__()[0](adPipelineContext());

      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub.firstCall.args[0]).to.deep.equal({
        name: 'intentiq',
        assetUrl: 'https://intentiq.test/tag.js',
        loadMethod: AssetLoadMethod.TAG
      });
    });

    it('should not load the script if vendor consent for gvl id 1323 is missing', async () => {
      const module = createModule({ ...intentIqConfig, scriptUrl: 'https://intentiq.test/tag.js' });
      await module.initSteps__()[0](adPipelineContext(fullConsent({ 1323: false })));

      expect(loadScriptStub).to.have.not.been.called;
    });

    it('should load the script if gdpr does not apply', async () => {
      const module = createModule({ ...intentIqConfig, scriptUrl: 'https://intentiq.test/tag.js' });
      await module.initSteps__()[0](adPipelineContext(tcDataNoGdpr));

      expect(loadScriptStub).to.have.been.calledOnce;
    });

    it('should not load the script in the test environment', async () => {
      const module = createModule({ ...intentIqConfig, scriptUrl: 'https://intentiq.test/tag.js' });
      await module.initSteps__()[0]({ ...adPipelineContext(), env__: 'test' });

      expect(loadScriptStub).to.have.not.been.called;
    });
  });

  describe('configure step', () => {
    it('should merge the intentIqId userId provider into the prebid config', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule();
      await module.configureSteps__()[0](adPipelineContext(), []);

      expect(mergeConfigSpy).to.have.been.calledOnce;
      expect(mergedProvider(mergeConfigSpy)).to.deep.equal({
        name: 'intentIqId',
        storage: {
          type: 'html5',
          name: 'intentIqId',
          expires: 0,
          refreshInSeconds: 0
        },
        params: {
          partner: 12345,
          domainName: 'example.com',
          region: 'gdpr'
        }
      });
    });

    it('should map all optional module config fields to the provider params', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule({
        ...intentIqConfig,
        browserBlockList: 'chrome,safari',
        abPercentage: 50,
        ABTestingConfigurationSource: 'group',
        group: 'B',
        storage: { expires: 30, refreshInSeconds: 3600 }
      });
      await module.configureSteps__()[0](adPipelineContext(), []);

      expect(mergedProvider(mergeConfigSpy)).to.deep.equal({
        name: 'intentIqId',
        storage: {
          type: 'html5',
          name: 'intentIqId',
          expires: 30,
          refreshInSeconds: 3600
        },
        params: {
          partner: 12345,
          domainName: 'example.com',
          region: 'gdpr',
          browserBlackList: 'chrome,safari',
          abPercentage: 50,
          ABTestingConfigurationSource: 'group',
          group: 'B'
        }
      });
    });

    it('should not set a domainName if no domain ad unit path variable is configured', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule();
      await module.configureSteps__()[0]({ ...adPipelineContext(), adUnitPathVariables__: {} }, []);

      expect(mergeConfigSpy).to.have.been.calledOnce;
      expect(mergedProvider(mergeConfigSpy).params).to.deep.equal({
        partner: 12345,
        region: 'gdpr'
      });
    });

    it('should not set a gamObjectReference if gamParameterName is not configured', async () => {
      jsDomWindow.googletag = createGoogletagStub();
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule();
      await module.configureSteps__()[0](adPipelineContext(), []);

      const params = mergedProvider(mergeConfigSpy).params;
      expect(params.gamParameterName).to.be.undefined;
      expect(params.gamObjectReference).to.be.undefined;
    });

    it('should set window.googletag as gamObjectReference if gamParameterName is configured', async () => {
      const googletagStub = createGoogletagStub();
      jsDomWindow.googletag = googletagStub;
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule({ ...intentIqConfig, gamParameterName: 'intent_iq_group' });
      await module.configureSteps__()[0](adPipelineContext(), []);

      const params = mergedProvider(mergeConfigSpy).params;
      expect(params.gamParameterName).to.equal('intent_iq_group');
      expect(params.gamObjectReference).to.equal(googletagStub);
    });

    it('should not merge if an intentIqId provider is already configured', async () => {
      sandbox.stub(jsDomWindow.pbjs, 'getConfig').returns({
        userSync: { userIds: [{ name: 'intentIqId', params: { partner: 999 } }] }
      });
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule();
      await module.configureSteps__()[0](adPipelineContext(), []);

      expect(mergeConfigSpy).to.have.not.been.called;
      // the userId entry is already there, but the analytics adapter still has to be enabled
      expect(enableAnalyticsSpy).to.have.been.calledOnce;
    });

    it('should merge if other userId providers are configured', async () => {
      sandbox.stub(jsDomWindow.pbjs, 'getConfig').returns({
        userSync: { userIds: [{ name: 'id5Id', params: { partner: 999 } }] }
      });
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule();
      await module.configureSteps__()[0](adPipelineContext(), []);

      expect(mergeConfigSpy).to.have.been.calledOnce;
    });

    it('should only merge once per requestAds cycle', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const module = createModule();
      const configureStep = module.configureSteps__()[0];
      const context = adPipelineContext();

      await configureStep(context, []);
      await configureStep(context, []);
      expect(mergeConfigSpy).to.have.been.calledOnce;

      await configureStep({ ...context, requestAdsCalls__: 2 }, []);
      expect(mergeConfigSpy).to.have.been.calledTwice;
    });

    it('should do nothing if prebid is not configured', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule();
      await module.configureSteps__()[0](
        adPipelineContext(fullConsent({ 1323: true }), emptyConfig),
        []
      );

      expect(mergeConfigSpy).to.have.not.been.called;
      expect(enableAnalyticsSpy).to.have.not.been.called;
    });

    it('should do nothing in the test environment', async () => {
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule();
      await module.configureSteps__()[0]({ ...adPipelineContext(), env__: 'test' }, []);

      expect(mergeConfigSpy).to.have.not.been.called;
      expect(enableAnalyticsSpy).to.have.not.been.called;
    });
  });

  describe('analytics adapter', () => {
    it('should enable the iiqAnalytics adapter', async () => {
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule();
      await module.configureSteps__()[0](adPipelineContext(), []);

      expect(enableAnalyticsSpy).to.have.been.calledOnce;
      expect(enabledAdapter(enableAnalyticsSpy)).to.deep.equal({
        provider: 'iiqAnalytics',
        options: {
          partner: 12345,
          domainName: 'example.com',
          region: 'gdpr'
        }
      });
    });

    it('should enable the adapter with the very same object the userId provider gets', async () => {
      const googletagStub = createGoogletagStub();
      jsDomWindow.googletag = googletagStub;
      const mergeConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'mergeConfig');
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule({
        ...intentIqConfig,
        browserBlockList: 'chrome,safari',
        abPercentage: 50,
        ABTestingConfigurationSource: 'group',
        group: 'B',
        gamParameterName: 'intent_iq_group'
      });
      await module.configureSteps__()[0](adPipelineContext(), []);

      // reference equality - IntentIQ requires one shared config object, not two equal ones
      expect(enabledAdapter(enableAnalyticsSpy).options).to.equal(
        mergedProvider(mergeConfigSpy).params
      );
      expect(enabledAdapter(enableAnalyticsSpy).options).to.deep.equal({
        partner: 12345,
        domainName: 'example.com',
        region: 'gdpr',
        browserBlackList: 'chrome,safari',
        abPercentage: 50,
        ABTestingConfigurationSource: 'group',
        group: 'B',
        gamParameterName: 'intent_iq_group',
        gamObjectReference: googletagStub
      });
    });

    it('should only enable the adapter once, even across requestAds cycles', async () => {
      const enableAnalyticsSpy = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');
      const module = createModule();
      const configureStep = module.configureSteps__()[0];
      const context = adPipelineContext();

      await configureStep(context, []);
      await configureStep({ ...context, requestAdsCalls__: 2 }, []);
      await configureStep({ ...context, requestAdsCalls__: 3 }, []);

      expect(enableAnalyticsSpy).to.have.been.calledOnce;
    });
  });
});
