import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import {
  AssetLoadMethod,
  createAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

import { Emetriq, EmetriqAppConfig, EmetriqWebConfig } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { AdPipelineContext, prebidjs } from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { EmetriqWindow } from './types/emetriq';
import { trackInApp } from './trackInApp';
import { createPbjsStub } from '@highfivve/ad-tag/lib/stubs/prebidjsStubs';

// setup sinon-chai
use(sinonChai);

describe('Emetriq Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: EmetriqWindow & prebidjs.IPrebidjsWindow = dom.window as any;
  const setTimeoutStub = sandbox.stub(jsDomWindow, 'setTimeout');

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const sid = 1337;
  const webConfig: EmetriqWebConfig = {
    os: 'web',
    _enqAdpParam: { sid }
  };
  const createEmetriqWeb = (): Emetriq => new Emetriq(webConfig, jsDomWindow);
  const tcDataWithConsent = fullConsent({ 213: true });

  const adPipelineContext = (): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: emptyConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      tcData: tcDataWithConsent,
      adUnitPathVariables: {}
    };
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createEmetriqWeb();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('emetriq');
  });

  describe('loadEmetriq', () => {
    const module = createEmetriqWeb();

    it('not load anything in a test environment', async () => {
      await module.loadEmetriqScript(
        { ...adPipelineContext(), env: 'test' },
        webConfig,
        {},
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 213 has no consent', async () => {
      await module.loadEmetriqScript(
        { ...adPipelineContext(), tcData: fullConsent({ 213: false }) },
        webConfig,
        {},
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    [adPipelineContext(), { ...adPipelineContext(), tcData: tcDataNoGdpr }].forEach(context =>
      it(`load emetriq if gdpr ${
        context.tcData.gdprApplies ? 'applies' : 'does not apply'
      }`, async () => {
        await module.loadEmetriqScript(context, webConfig, {}, assetLoaderService);

        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: `https://ups.xplosion.de/loader/${sid}/default.js`
        });
      })
    );

    it('should set window._enqAdpParam from config', async () => {
      const moduleConfig: EmetriqWebConfig = {
        os: 'web',
        _enqAdpParam: {
          sid: 55,
          zip: '12345',
          custom1: '12,34,56',
          custom4: 'yes',
          id_sharedid: '123'
        }
      };
      const module = new Emetriq(moduleConfig, jsDomWindow);
      await module.loadEmetriqScript(adPipelineContext(), moduleConfig, {}, assetLoaderService);

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam).to.be.deep.eq(moduleConfig._enqAdpParam);
    });

    it('should merge additionalIdentifiers', async () => {
      const moduleConfig: EmetriqWebConfig = {
        os: 'web',
        _enqAdpParam: {
          sid: 55,
          zip: '12345',
          custom1: '12,34,56',
          custom4: 'yes',
          id_sharedid: '123',
          id_criteoid: 'xxx'
        }
      };
      const module = new Emetriq(moduleConfig, jsDomWindow);
      await module.loadEmetriqScript(
        adPipelineContext(),
        moduleConfig,
        {
          id_criteoid: '567',
          id_id5: '1010'
        },
        assetLoaderService
      );

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam?.id_sharedid).to.be.eq('123');
      expect(jsDomWindow._enqAdpParam?.id_criteoid).to.be.eq('567');
      expect(jsDomWindow._enqAdpParam?.id_id5).to.be.eq('1010');
    });
  });

  describe('trackInApp', () => {
    const appConfig: EmetriqAppConfig = {
      sid: 123,
      os: 'android',
      appId: 'com.highfivve.app',
      advertiserIdKey: 'advertiserId',
      linkOrKeyword: {
        keywords: 'pokemon'
      }
    };
    jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve({} as any);
    let fetchSpy = sandbox.spy(jsDomWindow, 'fetch');

    beforeEach(() => {
      jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        Promise.resolve({} as any);

      fetchSpy = sandbox.spy(jsDomWindow, 'fetch');
    });

    it('should call the endpoint with keywords ', async () => {
      await trackInApp(adPipelineContext(), appConfig, {}, fetchSpy, noopLogger);
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
        `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
      );
    });

    ['ios' as const, 'android' as const].forEach(os =>
      it(`should call the endpoint with the os parameter ${os}`, async () => {
        await trackInApp(adPipelineContext(), { ...appConfig, os: os }, {}, fetchSpy, noopLogger);
        expect(fetchSpy).to.have.been.calledOnce;
        const [urlCalled] = fetchSpy.firstCall.args;
        expect(urlCalled).to.be.eq(
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
      await trackInApp(adPipelineContext(), appConfigWithLink, {}, fetchSpy, noopLogger);
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
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
        fetchSpy,
        noopLogger
      );
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
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
        fetchSpy,
        noopLogger
      );
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
        `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&id_id5=20c0c6f5-b89a-42ff-ab34-24da7cccf9ff&id_sharedid=1c6e063f-feaa-40a0-8a86-b9be3c655c39&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
      );
    });

    it('should call the endpoint with external additional identifier params ', async () => {
      const id5Id = '20c0c6f5-b89a-42ff-ab34-24da7cccf9ff';
      const sharedId = '1c6e063f-feaa-40a0-8a86-b9be3c655c39';
      const criteoId = '303e3571-9f2a-47ec-b62d-457ebfb5f068';
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
          id_criteoid: criteoId
        },
        fetchSpy,
        noopLogger
      );
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
        `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&id_id5=${id5Id}&id_sharedid=${sharedId}&id_criteoid=${criteoId}&gdpr=1&gdpr_consent=${tcDataWithConsent.tcString}`
      );
    });

    it('should call endpoint when gdpr does not apply', async () => {
      await trackInApp(
        { ...adPipelineContext(), tcData: tcDataNoGdpr },
        appConfig,
        {},
        fetchSpy,
        noopLogger
      );
      expect(fetchSpy).to.have.been.calledOnce;
      const [urlCalled] = fetchSpy.firstCall.args;
      expect(urlCalled).to.be.eq(
        `https://aps.xplosion.de/data?sid=123&os=android&app_id=com.highfivve.app&keywords=pokemon&gdpr=0`
      );
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
      (jsDomWindow.pbjs as any) = undefined;
      await Emetriq.syncDelay(adPipelineContext(), 'pbjs');

      expect(setTimeoutStub).to.have.not.been.called;
    });
  });
});
