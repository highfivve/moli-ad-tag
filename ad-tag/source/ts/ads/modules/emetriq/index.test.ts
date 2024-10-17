import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { emptyConfig, emptyRuntimeConfig, noopLogger } from 'ad-tag/stubs/moliStubs';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { EmetriqWindow } from 'ad-tag/types/emetriq';
import { GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { Emetriq } from 'ad-tag/ads/modules/emetriq/index';
import { modules } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { trackInApp } from 'ad-tag/ads/modules/emetriq/trackInApp';
import { shouldTrackLoginEvent, trackLoginEvent } from 'ad-tag/ads/modules/emetriq/trackLoginEvent';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';

// setup sinon-chai
use(sinonChai);

describe('Emetriq Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: EmetriqWindow & prebidjs.IPrebidjsWindow = dom.window as any;
  const setTimeoutStub = sandbox.stub(jsDomWindow, 'setTimeout');

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');
  const syncDelaySpy = sandbox.spy(Emetriq, 'syncDelay');

  const sid = 1337;
  const tcDataWithConsent = fullConsent({ 213: true });
  const createEmetriq = (): Emetriq => new Emetriq();

  const webConfig: modules.emetriq.EmetriqWebConfig = {
    enabled: true,
    os: 'web',
    _enqAdpParam: { sid }
  };
  const modulesConfig: modules.ModulesConfig = {
    emetriq: {
      ...webConfig
    }
  };

  const adPipelineContext = (): AdPipelineContext => {
    return {
      auctionId: 'xxxx-xxxx-xxxx-xxxx',
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: emptyConfig,
      window: jsDomWindow as any,
      runtimeConfig: emptyRuntimeConfig,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: tcDataWithConsent,
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow as any),
      assetLoaderService: assetLoaderService
    };
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init and a configure step', async () => {
    const module = createEmetriq();
    module.configure(modulesConfig);
    const initSteps = module.initSteps();
    const configureSteps = module.configureSteps();

    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('load-emetriq');
    expect(configureSteps).to.have.length(1);
    expect(configureSteps[0].name).to.be.eq('track-emetriq');
  });

  describe('init step', () => {
    it('should execute nothing in test mode', async () => {
      const module = createEmetriq();
      module.configure(modulesConfig);
      const initSteps = module.initSteps();

      const step = initSteps[0];
      expect(step).to.be.ok;

      await step!({ ...adPipelineContext(), env: 'test' });
      expect(syncDelaySpy).to.have.not.been.called;
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('should execute nothing if consent is not provided', async () => {
      const module = createEmetriq();
      module.configure(modulesConfig);
      const initSteps = module.initSteps();

      const step = initSteps[0];
      expect(step).to.be.ok;

      await step!({ ...adPipelineContext(), tcData: fullConsent({ 213: false }) });
      expect(syncDelaySpy).to.have.not.been.called;
      expect(loadScriptStub).to.have.not.been.called;
    });
  });

  describe('configure step', () => {
    it('should track nothing in test mode', async () => {
      const module = createEmetriq();
      module.configure(modulesConfig);
      const configureSteps = module.configureSteps();
      const trackInAppSpy = sandbox.spy(trackInApp);
      const trackLoginEventSpy = sandbox.spy(trackLoginEvent);

      const step = configureSteps[0];
      expect(step).to.be.ok;

      await step!({ ...adPipelineContext(), env: 'test' }, []);
      expect(syncDelaySpy).to.have.not.been.called;
      expect(trackInAppSpy).to.have.not.been.called;
      expect(trackLoginEventSpy).to.have.not.been.called;
    });

    it('should execute nothing if consent is not provided', async () => {
      const module = createEmetriq();
      module.configure(modulesConfig);
      const configureSteps = module.configureSteps();
      const trackInAppSpy = sandbox.spy(trackInApp);
      const trackLoginEventSpy = sandbox.spy(trackLoginEvent);

      const step = configureSteps[0];
      expect(step).to.be.ok;

      await step!({ ...adPipelineContext(), tcData: fullConsent({ 213: false }) }, []);
      expect(syncDelaySpy).to.have.not.been.called;
      expect(trackInAppSpy).to.have.not.been.called;
      expect(trackLoginEventSpy).to.have.not.been.called;
    });
  });

  describe('loadEmetriq', () => {
    const module = createEmetriq();
    module.configure(modulesConfig);

    [adPipelineContext(), { ...adPipelineContext(), tcData: tcDataNoGdpr }].forEach(context =>
      it(`load emetriq if gdpr ${
        context.tcData.gdprApplies ? 'applies' : 'does not apply'
      }`, async () => {
        await module.loadEmetriqScript(context, webConfig, {}, {});

        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: `https://ups.xplosion.de/loader/${sid}/default.js`
        });
      })
    );

    it('should set window._enqAdpParam from config', async () => {
      const webConfig: modules.emetriq.EmetriqWebConfig = {
        enabled: true,
        os: 'web',
        _enqAdpParam: {
          sid: 55,
          zip: '12345',
          c_iabV3Ids: '12,34,56',
          c_awesome: 'yes',
          id_sharedid: '123'
        }
      };

      const modulesConfig: modules.ModulesConfig = {
        emetriq: {
          ...webConfig
        }
      };

      const module = createEmetriq();
      module.configure(modulesConfig);
      await module.loadEmetriqScript(adPipelineContext(), webConfig, {}, {});

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam).to.be.deep.eq(webConfig._enqAdpParam);
    });

    it('should merge additionalIdentifiers', async () => {
      const webConfig: modules.emetriq.EmetriqWebConfig = {
        enabled: true,
        os: 'web',
        _enqAdpParam: {
          sid: 55,
          zip: '12345',
          c_iabV3Ids: '12,34,56',
          c_awesome: 'yes',
          id_sharedid: '123',
          id_liveramp: 'xxx'
        }
      };

      const modulesConfig: modules.ModulesConfig = {
        emetriq: {
          ...webConfig
        }
      };

      const module = createEmetriq();
      module.configure(modulesConfig);

      await module.loadEmetriqScript(
        adPipelineContext(),
        webConfig,
        {
          id_liveramp: '567',
          id_id5: '1010'
        },
        {}
      );

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam?.id_sharedid).to.be.eq('123');
      expect(jsDomWindow._enqAdpParam?.id_liveramp).to.be.eq('567');
      expect(jsDomWindow._enqAdpParam?.id_id5).to.be.eq('1010');
    });

    it('should merge additional custom parameters', async () => {
      const webConfig: modules.emetriq.EmetriqWebConfig = {
        enabled: true,
        os: 'web',
        _enqAdpParam: {
          sid: 55,
          zip: '12345',
          c_iabV3Ids: '12,34,56',
          c_awesome: 'yes'
        }
      };

      const modulesConfig: modules.ModulesConfig = {
        emetriq: {
          ...webConfig
        }
      };

      const module = createEmetriq();
      module.configure(modulesConfig);

      await module.loadEmetriqScript(
        adPipelineContext(),
        webConfig,
        {},
        {
          c_iabV3Ids: 'override',
          c_new: 'new'
        }
      );

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam?.c_iabV3Ids).to.be.eq('override');
      expect(jsDomWindow._enqAdpParam?.c_new).to.be.eq('new');
      expect(jsDomWindow._enqAdpParam?.c_awesome).to.be.eq('yes');
    });
  });

  describe('tracking APIs', () => {
    jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve({} as any);
    const createElementSpy = sandbox.spy(jsDomWindow.document, 'createElement');
    const bodyAppendSpy = sandbox.spy(jsDomWindow.document.body, 'append');

    const getValidatedTrackingPixel = (): HTMLImageElement => {
      expect(createElementSpy).to.have.been.calledOnce;
      expect(bodyAppendSpy).to.have.been.calledOnce;
      const [node] = bodyAppendSpy.firstCall.args;
      expect(node).to.not.be.a('string');
      const img = node as HTMLImageElement;
      expect(img.width).to.be.eq(1);
      expect(img.height).to.be.eq(1);
      return img;
    };

    describe('trackInApp', () => {
      const appConfig: modules.emetriq.EmetriqAppConfig = {
        enabled: true,
        sid: 123,
        os: 'android',
        appId: 'com.highfivve.app',
        advertiserIdKey: 'advertiserId',
        linkOrKeyword: {
          keywords: 'pokemon'
        }
      };

      it('should call the endpoint with keywords ', async () => {
        await trackInApp(adPipelineContext(), appConfig, {}, {}, jsDomWindow.document);
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      ['ios' as const, 'android' as const].forEach(os =>
        it(`should call the endpoint with the os parameter ${os}`, async () => {
          await trackInApp(
            adPipelineContext(),
            { ...appConfig, os: os },
            {},
            {},
            jsDomWindow.document
          );
          const img = getValidatedTrackingPixel();
          expect(img.src).to.be.eq(
            `https://aps.xplosion.de/data?sid=123&os=${os}&app_id=com.highfivve.app&keywords=pokemon&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
          );
        })
      );

      it('should call the endpoint with link set ', async () => {
        const appConfigWithLink = {
          ...appConfig,
          linkOrKeyword: {
            link: 'https://www.example.com?param=foo'
          }
        };
        await trackInApp(adPipelineContext(), appConfigWithLink, {}, {}, jsDomWindow.document);
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&link=https%3A%2F%2Fwww.example.com%3Fparam%3Dfoo&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      it('should call the endpoint with advertiserIdKey as device_id if provided ', async () => {
        const advertiserId = '8744bceb-91e5-4c20-8fe9-3fdddb13107f';
        await trackInApp(
          {
            ...adPipelineContext(),
            config: { ...emptyConfig, targeting: { keyValues: { advertiserId } } }
          },
          appConfig,
          {},
          {},
          jsDomWindow.document
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&device_id=${advertiserId}&os=android&app_id=com.highfivve.app&keywords=pokemon&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      it('should call the endpoint with additional identifier params ', async () => {
        await trackInApp(
          adPipelineContext(),
          {
            ...appConfig,
            additionalIdentifier: {
              id_id5: '20c0c6f5-b89a-42ff-ab34-24da7cccf9ff',
              id_sharedid: '1c6e063f-feaa-40a0-8a86-b9be3c655c39'
            }
          },
          {},
          {},
          jsDomWindow.document
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&id_id5=20c0c6f5-b89a-42ff-ab34-24da7cccf9ff&id_sharedid=1c6e063f-feaa-40a0-8a86-b9be3c655c39&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      it('should call the endpoint with additional custom params ', async () => {
        await trackInApp(
          adPipelineContext(),
          {
            ...appConfig,
            additionalIdentifier: {}
          },
          {},
          {
            c_iabV3Ids: '12,34',
            c_awesome: 'yes'
          },
          jsDomWindow.document
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&c_iabV3Ids=12%2C34&c_awesome=yes&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      it('should call the endpoint with external additional identifier params ', async () => {
        const id5Id = '20c0c6f5-b89a-42ff-ab34-24da7cccf9ff';
        const sharedId = '1c6e063f-feaa-40a0-8a86-b9be3c655c39';
        const liverampId = '303e3571-9f2a-47ec-b62d-457ebfb5f068';
        await trackInApp(
          adPipelineContext(),
          {
            ...appConfig,
            additionalIdentifier: {
              id_id5: id5Id,
              id_sharedid: '0df51310-5b4d-49eb-989f-0dfb5323170e'
            }
          },
          {
            id_sharedid: sharedId,
            id_liveramp: liverampId
          },
          {},
          jsDomWindow.document
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&id_id5=${id5Id}&id_sharedid=${sharedId}&id_liveramp=${liverampId}&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
        );
      });

      it('should call endpoint when gdpr does not apply', async () => {
        await trackInApp(
          { ...adPipelineContext(), tcData: tcDataNoGdpr },
          appConfig,
          {},
          {},
          jsDomWindow.document
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&gdpr=0`
        );
      });
    });

    describe('trackLoginEvent', () => {
      const loginConfig: modules.emetriq.EmetriqLoginEventConfig = {
        partner: 'partner-123',
        guid: 'abc123efg456'
      };
      const loginWebConfig: modules.emetriq.EmetriqWebConfig = {
        ...webConfig,
        login: loginConfig
      };

      const sessionStorage: Storage = {
        length: 0,
        getItem(key: string): string | null {
          return null;
        },
        setItem(key: string, value: string) {
          return;
        },
        key(index: number): string | null {
          return null;
        },
        removeItem(key: string) {
          return;
        },
        clear() {
          return;
        }
      };

      const getItemStub = sandbox.stub(sessionStorage, 'getItem');
      const setItemSpy = sandbox.spy(sessionStorage, 'setItem');

      // 2023-05-30 10:30:00
      const now = 1685435386900;

      describe('shouldTrack', () => {
        it('should return true if session storage is empty', () => {
          getItemStub.returns(null);
          expect(shouldTrackLoginEvent(sessionStorage, now, noopLogger)).to.be.true;
          expect(setItemSpy).to.have.been.calledOnce;

          // check correct update
          const [key, newDate] = setItemSpy.firstCall.args;
          expect(key).be.eq('moli_emetriq');
          expect(newDate).be.eq(now.toString(10));
        });

        it('should return true if user has not been tracked in the last 24 hours', () => {
          getItemStub.returns((now - 86400001).toString(10));
          expect(shouldTrackLoginEvent(sessionStorage, now, noopLogger)).to.be.true;
          expect(setItemSpy).to.have.been.calledOnce;

          // check correct update
          const [key, newDate] = setItemSpy.firstCall.args;
          expect(key).be.eq('moli_emetriq');
          expect(newDate).be.eq(now.toString(10));
        });

        it('should return false if user has been tracked in the last 24 hours', () => {
          getItemStub.returns((now - 1).toString(10));
          expect(shouldTrackLoginEvent(sessionStorage, now, noopLogger)).to.be.false;
          expect(setItemSpy).to.have.not.been.called;
        });
        it('should return false if user has been tracked in the last 24 hours #2', () => {
          const trackedAt = 1685521560826;
          const currentDate = 1685521560826;
          getItemStub.returns(trackedAt.toString(10));
          expect(shouldTrackLoginEvent(sessionStorage, currentDate, noopLogger)).to.be.false;
          expect(setItemSpy).to.have.not.been.called;
        });
      });

      it('should not fetch if login configuration is missing', async () => {
        await trackLoginEvent(adPipelineContext(), webConfig, jsDomWindow.document, noopLogger);
        expect(createElementSpy).to.have.not.been.called;
        expect(bodyAppendSpy).to.have.not.been.called;
      });

      it('should call endpoint with idfa for iOS config', async () => {
        const advertiserId = 'xxxx-yyyy-zzzz';
        const iosConfig: modules.emetriq.EmetriqAppConfig = {
          enabled: true,
          os: 'ios',
          sid: sid,
          appId: 'com.example.app',
          advertiserIdKey: 'advertiserId',
          linkOrKeyword: { link: 'http://localhost' },
          login: loginConfig
        };
        await trackLoginEvent(
          {
            ...adPipelineContext(),
            config: { ...emptyConfig, targeting: { keyValues: { advertiserId } } },
            tcData: tcDataNoGdpr
          },
          iosConfig,
          jsDomWindow.document,
          noopLogger
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://xdn-ttp.de/lns/import-event-partner-123?guid=abc123efg456&gdpr=0&idfa=${advertiserId}`
        );
      });

      it('should call endpoint with adid for android config', async () => {
        const advertiserId = 'xxxx-yyyy-zzzz';
        const iosConfig: modules.emetriq.EmetriqAppConfig = {
          enabled: true,
          os: 'android',
          sid: sid,
          appId: 'com.example.app',
          advertiserIdKey: 'advertiserId',
          linkOrKeyword: { link: 'http://localhost' },
          login: loginConfig
        };
        await trackLoginEvent(
          {
            ...adPipelineContext(),
            config: { ...emptyConfig, targeting: { keyValues: { advertiserId } } },
            tcData: tcDataNoGdpr
          },
          iosConfig,
          jsDomWindow.document,
          noopLogger
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://xdn-ttp.de/lns/import-event-partner-123?guid=abc123efg456&gdpr=0&adid=${advertiserId}`
        );
      });

      it('should call endpoint when gdpr does apply', async () => {
        const tcData = fullConsent();
        await trackLoginEvent(
          { ...adPipelineContext(), tcData },
          loginWebConfig,
          jsDomWindow.document,
          noopLogger
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          `https://xdn-ttp.de/lns/import-event-partner-123?guid=abc123efg456&gdpr=1&gdpr_consent=${tcData.tcString}`
        );
      });

      it('should call endpoint when gdpr does not apply', async () => {
        await trackLoginEvent(
          { ...adPipelineContext(), tcData: tcDataNoGdpr },
          loginWebConfig,
          jsDomWindow.document,
          noopLogger
        );
        const img = getValidatedTrackingPixel();
        expect(img.src).to.be.eq(
          'https://xdn-ttp.de/lns/import-event-partner-123?guid=abc123efg456&gdpr=0'
        );
      });
    });
  });

  describe('syncDelay', () => {
    beforeEach(() => {
      jsDomWindow.pbjs = createPbjsStub();
    });

    it('should resolve immediately if no value is provided', async () => {
      const onEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
      await Emetriq.syncDelay(adPipelineContext());

      expect(setTimeoutStub).to.have.not.been.called;
      expect(onEventSpy).to.have.not.been.called;
    });

    it('should use setTimeout if syncDelay is a number', async () => {
      setTimeoutStub.callsFake(handler => {
        if (typeof handler === 'function') {
          handler();
        }
        return 0;
      });
      const onEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
      await Emetriq.syncDelay(adPipelineContext(), 500);

      expect(setTimeoutStub).to.have.been.calledOnce;
      const [handler, setTimeoutDelay] = setTimeoutStub.firstCall.args;
      expect(handler).to.be.a('function');
      expect(setTimeoutDelay).to.be.eq(500);

      expect(onEventSpy).to.have.not.been.called;
    });

    it('should use auctionEnd if pbjs is configured', async () => {
      const onEventStub = sandbox
        .stub(jsDomWindow.pbjs, 'onEvent')
        .callsFake((_, callback) => callback());
      const offEventStub = sandbox.stub(jsDomWindow.pbjs, 'offEvent');
      await Emetriq.syncDelay(adPipelineContext(), 'pbjs');

      expect(setTimeoutStub).to.have.not.been.called;
      expect(onEventStub).to.have.been.calledOnce;
      expect(offEventStub).to.have.been.calledOnce;

      const [onEvent] = onEventStub.firstCall.args;
      const [offEvent] = offEventStub.firstCall.args;

      expect(onEvent).to.be.eq('auctionEnd');
      expect(offEvent).to.be.eq('auctionEnd');
    });

    it('should resolve immediately if pbjs is configured, but window.pbjs is undefined', async () => {
      const ctx = adPipelineContext();

      // remove the pbjs object that was added by the GlobalAuctionContext initialized
      (jsDomWindow.pbjs as any) = undefined;
      await Emetriq.syncDelay(ctx, 'pbjs');

      expect(setTimeoutStub).to.have.not.been.called;
    });
  });

  describe('staticCustomParams', () => {
    it('should return an empty object if mappings are undefined', () => {
      expect(Emetriq.staticCustomParams({}, undefined)).to.be.deep.eq({});
    });

    it('should return an empty object if mappings are an empty array', () => {
      expect(Emetriq.staticCustomParams({}, [])).to.be.deep.eq({});
    });

    it('should return string as string', () => {
      expect(
        Emetriq.staticCustomParams({ k: 'value' }, [{ param: 'c_param1', key: 'k' }])
      ).to.be.deep.eq({
        c_param1: 'value'
      });
    });

    it('should return string arrays as string with string concatenated', () => {
      expect(
        Emetriq.staticCustomParams({ k: ['val1', 'val2'] }, [{ param: 'c_param1', key: 'k' }])
      ).to.be.deep.eq({
        c_param1: 'val1,val2'
      });
    });

    it('should omit missing keys', () => {
      expect(
        Emetriq.staticCustomParams({ k1: 'value', k3: 'unused' }, [
          { param: 'c_param1', key: 'k1' },
          { param: 'c_param2', key: 'notAvailable' }
        ])
      ).to.be.deep.eq({
        c_param1: 'value'
      });
    });
  });
});
