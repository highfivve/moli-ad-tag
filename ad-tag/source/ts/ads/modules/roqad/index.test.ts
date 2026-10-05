import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { newEmptyConfig, newEmptyRuntimeConfig, newNoopLogger } from 'ad-tag/stubs/moliStubs';
import { createLabelConfigService } from 'ad-tag/ads/labelConfigService';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createRoqad } from './index';

use(sinonChai);

describe('ROQAD Mapper module', () => {
  const sandbox = Sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const defaultConfig: modules.roqad.RoqadModuleConfig = {
    enabled: true,
    zdid: '1234',
    publisherName: 'example pub',
    spaMode: false,
    mappingDefinitions: []
  };

  const fullRoqadConsent = () => fullConsent({ 4: true, 301: true });

  const createModule = (config: Partial<modules.roqad.RoqadModuleConfig> = {}) => {
    const module = createRoqad();
    module.configure__({ roqad: { ...defaultConfig, ...config } });
    return module;
  };

  const mkContext = (
    overrides: Partial<AdPipelineContext> & {
      labels?: string[];
      keyValues?: Record<string, string | string[]>;
      runtimeKeyValues?: Record<string, string | string[]>;
      hem?: MoliRuntime.AudienceTargeting['hem'];
    } = {}
  ): AdPipelineContext => {
    const { labels, keyValues, runtimeKeyValues, hem, ...contextOverrides } = overrides;
    const config = newEmptyConfig();
    const runtimeConfig = newEmptyRuntimeConfig();
    return adPipelineContext(jsDomWindow, {
      tcData__: fullRoqadConsent(),
      assetLoaderService__: assetLoaderService,
      labelConfigService__: createLabelConfigService([], labels ?? [], jsDomWindow),
      config__: { ...config, targeting: { keyValues: keyValues ?? {} } },
      runtimeConfig__: {
        ...runtimeConfig,
        keyValues: runtimeKeyValues ?? {},
        ...(hem ? { audience: { hem } } : {})
      },
      ...contextOverrides
    });
  };

  const runInitStep = async (
    module: ReturnType<typeof createRoqad>,
    context: AdPipelineContext
  ): Promise<void> => {
    const initSteps = module.initSteps__();
    expect(initSteps).to.have.length(1);
    await initSteps[0](context);
  };

  const getLoadedUrl = (): URL => {
    expect(loadScriptStub).to.have.been.calledOnce;
    return new URL(loadScriptStub.firstCall.args[0].assetUrl);
  };

  const getRawQuery = (): string => loadScriptStub.firstCall.args[0].assetUrl.split('?')[1];

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('configuration', () => {
    it('has the roqad config key and dmp module type', () => {
      const module = createRoqad();
      expect(module.configKey).to.eq('roqad');
      expect(module.moduleType).to.eq('dmp');
    });

    it('adds no steps if not configured', () => {
      const module = createRoqad();
      module.configure__({});
      expect(module.initSteps__()).to.be.empty;
      expect(module.configureSteps__()).to.be.empty;
      expect(module.config__()).to.be.null;
    });

    it('adds no steps if disabled', () => {
      const module = createModule({ enabled: false });
      expect(module.initSteps__()).to.be.empty;
      expect(module.config__()).to.be.null;
    });

    it('adds an init step if enabled', () => {
      const module = createModule();
      expect(module.initSteps__()).to.have.length(1);
      expect(module.config__()).to.deep.eq(defaultConfig);
    });
  });

  describe('consent', () => {
    it('loads mapper.js with vendor 4, vendor 301 and purpose 1 consent', async () => {
      await runInitStep(createModule(), mkContext());
      expect(loadScriptStub).to.have.been.calledOnceWith(
        Sinon.match({ name: 'roqad', loadMethod: AssetLoadMethod.TAG })
      );
      const url = getLoadedUrl();
      expect(url.origin + url.pathname).to.eq('https://zd.rqtrk.eu/mapper.js');
    });

    it('does not load without vendor consent for roqad (4)', async () => {
      await runInitStep(createModule(), mkContext({ tcData__: fullConsent({ 301: true }) }));
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('does not load without vendor consent for zeotap (301)', async () => {
      await runInitStep(createModule(), mkContext({ tcData__: fullConsent({ 4: true }) }));
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('does not load without purpose 1 consent', async () => {
      const tcData = fullRoqadConsent();
      const noPurpose1: tcfapi.responses.TCDataWithGDPR = {
        ...tcData,
        purpose: {
          ...tcData.purpose,
          consents: {
            ...tcData.purpose.consents,
            [tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE]: false
          }
        }
      };
      await runInitStep(createModule(), mkContext({ tcData__: noPurpose1 }));
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('loads if gdpr does not apply', async () => {
      await runInitStep(createModule(), mkContext({ tcData__: tcDataNoGdpr }));
      expect(loadScriptStub).to.have.been.calledOnce;
    });
  });

  describe('fixed parameters', () => {
    it('adds zdid, env, eventType, publisher_name and partner_dom', async () => {
      await runInitStep(createModule(), mkContext());
      const params = getLoadedUrl().searchParams;
      expect(params.get('zdid')).to.eq('1234');
      expect(params.get('env')).to.eq('desktop');
      expect(params.get('eventType')).to.eq('pageview');
      expect(params.get('publisher_name')).to.eq('example pub');
      expect(params.get('partner_dom')).to.eq(jsDomWindow.location.hostname);
    });

    it('never adds a ctry parameter', async () => {
      await runInitStep(createModule(), mkContext());
      expect(getLoadedUrl().searchParams.has('ctry')).to.be.false;
    });

    it('sets env to mWeb if the mobile label is active', async () => {
      await runInitStep(createModule(), mkContext({ labels: ['mobile'] }));
      expect(getLoadedUrl().searchParams.get('env')).to.eq('mWeb');
    });

    it('sets env to desktop if the mobile label is not active', async () => {
      await runInitStep(createModule(), mkContext({ labels: ['desktop'] }));
      expect(getLoadedUrl().searchParams.get('env')).to.eq('desktop');
    });
  });

  describe('hashed email (z_e_sha2_l)', () => {
    it('uses sha256BasicNormalized if available', async () => {
      await runInitStep(
        createModule(),
        mkContext({ hem: { sha256: 'gmail-normalized', sha256BasicNormalized: 'basic' } })
      );
      expect(getLoadedUrl().searchParams.get('z_e_sha2_l')).to.eq('basic');
    });

    it('falls back to sha256', async () => {
      await runInitStep(createModule(), mkContext({ hem: { sha256: 'gmail-normalized' } }));
      expect(getLoadedUrl().searchParams.get('z_e_sha2_l')).to.eq('gmail-normalized');
    });

    it('omits the parameter if no hashed email is available', async () => {
      await runInitStep(createModule(), mkContext({ hem: { md5: 'md5' } }));
      expect(getLoadedUrl().searchParams.has('z_e_sha2_l')).to.be.false;
    });
  });

  describe('parameter mapping', () => {
    const mapping = (
      key: string,
      parameter: string,
      defaultValue?: string
    ): modules.roqad.RoqadParameterMapping => ({
      roqadValueType: 'string',
      key,
      parameter,
      ...(defaultValue !== undefined ? { defaultValue } : {})
    });

    it('maps a targeting key-value to a parameter', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'sports' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('sports');
    });

    it('prefers runtime key-values over targeting key-values', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'sports' }, runtimeKeyValues: { channel: 'news' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('news');
    });

    it('url-encodes string values', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'a&b c' } })
      );
      expect(getRawQuery()).to.contain('category=a%26b%20c');
    });

    it('encodes array elements individually and joins them with a literal comma', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('tags', 'interests')] }),
        mkContext({ keyValues: { tags: ['a,b', 'c d', 'e'] } })
      );
      expect(getRawQuery()).to.contain('interests=a%2Cb,c%20d,e');
    });

    it('uses the default value if the key-value is missing', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext()
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('uses the default value for an empty string', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext({ keyValues: { channel: '' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('uses the default value for an empty array', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext({ keyValues: { channel: [] } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('omits the parameter if the value is missing and no default is set', async () => {
      await runInitStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: [] } })
      );
      expect(getLoadedUrl().searchParams.has('category')).to.be.false;
    });

    it('appends mapped parameters after the fixed parameters', async () => {
      await runInitStep(
        createModule({
          mappingDefinitions: [mapping('channel', 'category'), mapping('age', 'age_group')]
        }),
        mkContext({ keyValues: { channel: 'sports', age: '30' } })
      );
      const keys = Array.from(getLoadedUrl().searchParams.keys());
      expect(keys).to.deep.eq([
        'zdid',
        'env',
        'eventType',
        'publisher_name',
        'partner_dom',
        'category',
        'age_group'
      ]);
    });
  });

  describe('spaMode and errors', () => {
    it('logs a warning in spaMode', async () => {
      const logger = newNoopLogger();
      const warnSpy = sandbox.spy(logger, 'warn');
      await runInitStep(createModule({ spaMode: true }), mkContext({ logger__: logger }));
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(warnSpy).to.have.been.calledOnce;
    });

    it('logs the spaMode warning even without consent', async () => {
      const logger = newNoopLogger();
      const warnSpy = sandbox.spy(logger, 'warn');
      await runInitStep(
        createModule({ spaMode: true }),
        mkContext({ logger__: logger, tcData__: fullConsent({}) })
      );
      expect(loadScriptStub).to.not.have.been.called;
      expect(warnSpy).to.have.been.calledOnce;
    });

    it('does not log a warning if spaMode is disabled', async () => {
      const logger = newNoopLogger();
      const warnSpy = sandbox.spy(logger, 'warn');
      await runInitStep(createModule(), mkContext({ logger__: logger }));
      expect(warnSpy).to.not.have.been.called;
    });

    it('does not fail the pipeline if loading the script fails', async () => {
      const logger = newNoopLogger();
      const errorSpy = sandbox.spy(logger, 'error');
      loadScriptStub.rejects(new Error('network'));
      await runInitStep(createModule(), mkContext({ logger__: logger }));
      // loading is not awaited by the pipeline step, so flush pending promises
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(errorSpy).to.have.been.calledOnce;
    });
  });
});
