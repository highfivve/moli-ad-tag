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

describe('ROQAD Cookie Sync module', () => {
  const sandbox = Sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const defaultConfig: modules.roqad.RoqadModuleConfig = {
    enabled: true,
    zdid: '1234',
    publisherName: 'example pub',
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

  const runSyncStep = async (
    module: ReturnType<typeof createRoqad>,
    context: AdPipelineContext
  ): Promise<void> => {
    const configureSteps = module.configureSteps__();
    expect(configureSteps).to.have.length(1);
    await configureSteps[0](context, []);
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
    jsDomWindow.document.querySelectorAll('iframe').forEach(iframe => iframe.remove());
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

    it('adds a single configure step and no init step if enabled', () => {
      const module = createModule();
      expect(module.initSteps__()).to.be.empty;
      expect(module.configureSteps__()).to.have.length(1);
      expect(module.config__()).to.deep.eq(defaultConfig);
    });

    it('uses the mapper sync method if syncMethod is not set', async () => {
      await runSyncStep(createModule(), mkContext());
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(jsDomWindow.document.querySelectorAll('iframe')).to.have.length(0);
    });
  });

  describe('consent', () => {
    it('loads mapper.js with vendor 4, vendor 301 and purpose 1 consent', async () => {
      await runSyncStep(createModule(), mkContext());
      expect(loadScriptStub).to.have.been.calledOnceWith(
        Sinon.match({ name: 'roqad', loadMethod: AssetLoadMethod.TAG })
      );
      const url = getLoadedUrl();
      expect(url.origin + url.pathname).to.eq('https://zd.rqtrk.eu/mapper.js');
    });

    const syncMethods: ReadonlyArray<modules.roqad.RoqadSyncMethod> = ['mapper', 'pixel'];
    syncMethods.forEach(syncMethod => {
      describe(`${syncMethod} sync method`, () => {
        const hasSynced = (): boolean =>
          loadScriptStub.called || jsDomWindow.document.querySelector('#h5v-roqad-sync') !== null;

        const sync = (tcData: tcfapi.responses.TCData) =>
          runSyncStep(createModule({ syncMethod }), mkContext({ tcData__: tcData }));

        it('syncs with vendor 4, vendor 301 and purpose 1 consent', async () => {
          await sync(fullRoqadConsent());
          expect(hasSynced()).to.be.true;
        });

        it('does not sync without vendor consent for roqad (4)', async () => {
          await sync(fullConsent({ 301: true }));
          expect(hasSynced()).to.be.false;
        });

        it('does not sync without vendor consent for zeotap (301)', async () => {
          await sync(fullConsent({ 4: true }));
          expect(hasSynced()).to.be.false;
        });

        it('does not sync without purpose 1 consent', async () => {
          const tcData = fullRoqadConsent();
          await sync({
            ...tcData,
            purpose: {
              ...tcData.purpose,
              consents: {
                ...tcData.purpose.consents,
                [tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE]: false
              }
            }
          });
          expect(hasSynced()).to.be.false;
        });

        it('syncs if gdpr does not apply', async () => {
          await sync(tcDataNoGdpr);
          expect(hasSynced()).to.be.true;
        });
      });
    });
  });

  describe('fixed parameters', () => {
    it('adds zdid, env, eventType, publisher_name and partner_dom', async () => {
      await runSyncStep(createModule(), mkContext());
      const params = getLoadedUrl().searchParams;
      expect(params.get('zdid')).to.eq('1234');
      expect(params.get('env')).to.eq('desktop');
      expect(params.get('eventType')).to.eq('pageview');
      expect(params.get('publisher_name')).to.eq('example pub');
      expect(params.get('partner_dom')).to.eq(jsDomWindow.location.hostname);
    });

    it('never adds a ctry parameter', async () => {
      await runSyncStep(createModule(), mkContext());
      expect(getLoadedUrl().searchParams.has('ctry')).to.be.false;
    });

    it('sets env to mWeb if the mobile label is active', async () => {
      await runSyncStep(createModule(), mkContext({ labels: ['mobile'] }));
      expect(getLoadedUrl().searchParams.get('env')).to.eq('mWeb');
    });

    it('sets env to desktop if the mobile label is not active', async () => {
      await runSyncStep(createModule(), mkContext({ labels: ['desktop'] }));
      expect(getLoadedUrl().searchParams.get('env')).to.eq('desktop');
    });
  });

  describe('hashed email (z_e_sha2_l)', () => {
    it('uses sha256BasicNormalized if available', async () => {
      await runSyncStep(
        createModule(),
        mkContext({ hem: { sha256: 'gmail-normalized', sha256BasicNormalized: 'basic' } })
      );
      expect(getLoadedUrl().searchParams.get('z_e_sha2_l')).to.eq('basic');
    });

    it('falls back to sha256', async () => {
      await runSyncStep(createModule(), mkContext({ hem: { sha256: 'gmail-normalized' } }));
      expect(getLoadedUrl().searchParams.get('z_e_sha2_l')).to.eq('gmail-normalized');
    });

    it('omits the parameter if no hashed email is available', async () => {
      await runSyncStep(createModule(), mkContext({ hem: { md5: 'md5' } }));
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
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'sports' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('sports');
    });

    it('prefers runtime key-values over targeting key-values', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'sports' }, runtimeKeyValues: { channel: 'news' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('news');
    });

    it('url-encodes string values', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: 'a&b c' } })
      );
      expect(getRawQuery()).to.contain('category=a%26b%20c');
    });

    it('encodes array elements individually and joins them with a literal comma', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('tags', 'interests')] }),
        mkContext({ keyValues: { tags: ['a,b', 'c d', 'e'] } })
      );
      expect(getRawQuery()).to.contain('interests=a%2Cb,c%20d,e');
    });

    it('uses the default value if the key-value is missing', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext()
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('uses the default value for an empty string', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext({ keyValues: { channel: '' } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('uses the default value for an empty array', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category', 'none')] }),
        mkContext({ keyValues: { channel: [] } })
      );
      expect(getLoadedUrl().searchParams.get('category')).to.eq('none');
    });

    it('omits the parameter if the value is missing and no default is set', async () => {
      await runSyncStep(
        createModule({ mappingDefinitions: [mapping('channel', 'category')] }),
        mkContext({ keyValues: { channel: [] } })
      );
      expect(getLoadedUrl().searchParams.has('category')).to.be.false;
    });

    it('appends mapped parameters after the fixed parameters', async () => {
      await runSyncStep(
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

  describe('sync timing', () => {
    it('syncs only once per requestAds cycle', async () => {
      const module = createModule();
      const step = module.configureSteps__()[0];
      // lazy loading and refreshes run the pipeline again within the same cycle
      await step(mkContext({ requestAdsCalls__: 1, requestId__: 1 }), []);
      await step(mkContext({ requestAdsCalls__: 1, requestId__: 2 }), []);
      await step(mkContext({ requestAdsCalls__: 1, requestId__: 3 }), []);
      expect(loadScriptStub).to.have.been.calledOnce;
    });

    it('loads mapper.js again on every requestAds cycle', async () => {
      const module = createModule({ syncMethod: 'mapper' });
      const step = module.configureSteps__()[0];
      await step(mkContext({ requestAdsCalls__: 1 }), []);
      await step(mkContext({ requestAdsCalls__: 2, runtimeKeyValues: { channel: 'news' } }), []);
      expect(loadScriptStub).to.have.been.calledTwice;
    });

    it('builds the URL with the key-values of the current cycle', async () => {
      const module = createModule({
        mappingDefinitions: [{ roqadValueType: 'string', key: 'channel', parameter: 'category' }]
      });
      const step = module.configureSteps__()[0];
      await step(mkContext({ requestAdsCalls__: 1, runtimeKeyValues: { channel: 'sports' } }), []);
      await step(mkContext({ requestAdsCalls__: 2, runtimeKeyValues: { channel: 'news' } }), []);
      const secondUrl = new URL(loadScriptStub.secondCall.args[0].assetUrl);
      expect(secondUrl.searchParams.get('category')).to.eq('news');
    });
  });

  describe('mapper sync method', () => {
    it('adds no consent parameters to the script URL', async () => {
      await runSyncStep(createModule({ syncMethod: 'mapper' }), mkContext());
      const params = getLoadedUrl().searchParams;
      expect(params.has('cmp')).to.be.false;
      expect(params.has('gdpr')).to.be.false;
      expect(params.has('gdpr_consent')).to.be.false;
      expect(params.has('uc')).to.be.false;
    });

    it('does not fail the pipeline if loading the script fails', async () => {
      const logger = newNoopLogger();
      const errorSpy = sandbox.spy(logger, 'error');
      loadScriptStub.rejects(new Error('network'));
      await runSyncStep(createModule(), mkContext({ logger__: logger }));
      // loading is not awaited by the pipeline step, so flush pending promises
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(errorSpy).to.have.been.calledOnce;
    });
  });

  describe('pixel sync method', () => {
    const pixelModule = (config: Partial<modules.roqad.RoqadModuleConfig> = {}) =>
      createModule({ syncMethod: 'pixel', ...config });

    const syncIframes = (): HTMLIFrameElement[] =>
      Array.from(jsDomWindow.document.querySelectorAll<HTMLIFrameElement>('#h5v-roqad-sync'));

    const getSyncIframe = (): HTMLIFrameElement => {
      const iframes = syncIframes();
      expect(iframes).to.have.length(1);
      return iframes[0];
    };

    const getPixelUrl = (): URL => new URL(getSyncIframe().src);

    it('does not load mapper.js', async () => {
      await runSyncStep(pixelModule(), mkContext());
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('appends a hidden iframe to the body', async () => {
      await runSyncStep(pixelModule(), mkContext());
      const iframe = getSyncIframe();
      expect(iframe.parentElement).to.eq(jsDomWindow.document.body);
      expect(iframe.style.display).to.eq('none');
      expect(iframe.width).to.eq('0');
      expect(iframe.height).to.eq('0');
      expect(iframe.style.border).to.match(/^(0|none)/);
      expect(iframe.title).to.not.be.empty;
      expect(iframe.hasAttribute('sandbox')).to.be.false;
    });

    it('loads the sync URL with fixed and mapped parameters followed by consent parameters', async () => {
      await runSyncStep(
        pixelModule({
          mappingDefinitions: [{ roqadValueType: 'string', key: 'channel', parameter: 'category' }]
        }),
        mkContext({ keyValues: { channel: 'sports' } })
      );
      const url = getPixelUrl();
      expect(url.origin + url.pathname).to.eq('https://zd.rqtrk.eu/');
      expect(Array.from(url.searchParams.keys())).to.deep.eq([
        'zdid',
        'env',
        'eventType',
        'publisher_name',
        'partner_dom',
        'category',
        'cmp',
        'gdpr',
        'gdpr_consent',
        'uc'
      ]);
      expect(url.searchParams.get('zdid')).to.eq('1234');
      expect(url.searchParams.get('category')).to.eq('sports');
      expect(url.searchParams.get('cmp')).to.eq('1');
      expect(url.searchParams.get('uc')).to.eq('1_2');
    });

    it('sends gdpr=1 and the url-encoded tcString if gdpr applies', async () => {
      const tcData = fullRoqadConsent();
      await runSyncStep(pixelModule(), mkContext({ tcData__: tcData }));
      expect(getPixelUrl().searchParams.get('gdpr')).to.eq('1');
      expect(getPixelUrl().searchParams.get('gdpr_consent')).to.eq(tcData.tcString);
      expect(getSyncIframe().src).to.contain(`gdpr_consent=${encodeURIComponent(tcData.tcString)}`);
    });

    it('omits gdpr_consent if the tcString is empty', async () => {
      await runSyncStep(
        pixelModule(),
        mkContext({ tcData__: { ...fullRoqadConsent(), tcString: '' } })
      );
      expect(getPixelUrl().searchParams.get('gdpr')).to.eq('1');
      expect(getPixelUrl().searchParams.has('gdpr_consent')).to.be.false;
    });

    it('sends gdpr=0 and no gdpr_consent if gdpr does not apply', async () => {
      await runSyncStep(pixelModule(), mkContext({ tcData__: tcDataNoGdpr }));
      const params = getPixelUrl().searchParams;
      expect(params.get('gdpr')).to.eq('0');
      expect(params.has('gdpr_consent')).to.be.false;
      expect(params.get('cmp')).to.eq('1');
      expect(params.get('uc')).to.eq('1_2');
    });

    it('sends gdpr_consent if gdpr does not apply but a tcString is set', async () => {
      const noGdprWithTcString = { ...tcDataNoGdpr, tcString: 'tc-string' };
      await runSyncStep(pixelModule(), mkContext({ tcData__: noGdprWithTcString }));
      const params = getPixelUrl().searchParams;
      expect(params.get('gdpr')).to.eq('0');
      expect(params.get('gdpr_consent')).to.eq('tc-string');
    });

    it('omits gdpr if gdprApplies is undefined', async () => {
      await runSyncStep(
        pixelModule(),
        mkContext({ tcData__: { ...tcDataNoGdpr, gdprApplies: undefined } })
      );
      expect(getPixelUrl().searchParams.has('gdpr')).to.be.false;
    });

    it('replaces the previous iframe on the next requestAds cycle', async () => {
      const module = pixelModule();
      const step = module.configureSteps__()[0];
      await step(mkContext({ requestAdsCalls__: 1 }), []);
      const first = getSyncIframe();
      await step(mkContext({ requestAdsCalls__: 2 }), []);
      const second = getSyncIframe();
      expect(second).to.not.eq(first);
      expect(first.isConnected).to.be.false;
    });

    it('appends a new iframe if the previous one was removed externally', async () => {
      const module = pixelModule();
      const step = module.configureSteps__()[0];
      await step(mkContext({ requestAdsCalls__: 1 }), []);
      // e.g. the single page application replaced the body content
      getSyncIframe().remove();
      await step(mkContext({ requestAdsCalls__: 2 }), []);
      expect(getSyncIframe().isConnected).to.be.true;
    });
  });
});
