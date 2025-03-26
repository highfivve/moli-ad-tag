import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import {
  gptConsentKeyValue,
  gptDefineSlots,
  gptDestroyAdSlots,
  gptInit,
  gptLDeviceLabelKeyValue,
  gptResetTargeting,
  gptConfigure,
  gptRequestAds
} from './googleAdManager';
import { noopReportingService } from './reportingService';
import { LabelConfigService } from './labelConfigService';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { fullConsent, tcData, tcDataNoGdpr, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { GlobalAuctionContext } from './globalAuctionContext';
import { EventService } from './eventService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('google ad manager', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    Pick<typeof globalThis, 'Date'> = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const adPipelineContext = (
    env: Moli.Environment = 'production',
    config: Moli.MoliConfig = emptyConfig,
    requestAdsCalls: number = 1
  ): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: requestAdsCalls,
      env: env,
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      labelConfigService: new LabelConfigService([], [], jsDomWindow),
      reportingService: noopReportingService,
      tcData: tcData,
      adUnitPathVariables: { domain: 'example.com', device: 'mobile' },
      auction: new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService())
    };
  };

  const matchMediaStub = sandbox.stub(dom.window, 'matchMedia');

  const sleep = (timeInMs: number = 20) =>
    new Promise(resolve => {
      setTimeout(resolve, timeInMs);
    });

  const createdAdSlot = (domId: string): Moli.AdSlot => ({
    domId: domId,
    adUnitPath: `/123/${domId}`,
    behaviour: { loaded: 'eager' },
    position: 'in-page',
    sizes: [[300, 250]],
    sizeConfig: [
      {
        mediaQuery: '(min-width: 0px)',
        sizesSupported: [[300, 250]]
      }
    ]
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    // reset the before each test
    dom.window.googletag = createGoogletagStub();
    dom.window.__tcfapi = tcfapiFunction(tcData);
    matchMediaStub.returns({ matches: true } as MediaQueryList);
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('gptInit', () => {
    it('should not load anything in test mode', async () => {
      const step = gptInit(assetLoaderService);
      await step(adPipelineContext('test'));
      expect(loadScriptStub).not.been.called;
    });
    it('should set the window.googletag', () => {
      const step = gptInit(assetLoaderService);
      (dom.window as any).googletag = undefined;
      expect(dom.window.googletag).to.be.undefined;

      const init = step(adPipelineContext());

      return sleep().then(() => {
        expect(dom.window.googletag).to.be.ok;
        (dom.window as any).googletag.cmd[0]();
        return init;
      });
    });

    it('should set the window.google only once', () => {
      const step = gptInit(assetLoaderService);
      (dom.window as any).googletag = undefined;
      expect(dom.window.googletag).to.be.undefined;

      const init = step(adPipelineContext());

      return sleep().then(() => {
        (dom.window as any).googletag.cmd[0]();
        // a second init call should resolve without processing the cmd queue
        return init.then(() => step(adPipelineContext()));
      });
    });
  });

  describe('gptConfigure', () => {
    it('setTargeting should not be called if targeting is empty', async () => {
      const step = gptConfigure(emptyConfig);
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      await step(adPipelineContext(), []);
      expect(setTargetingSpy).to.have.not.been.called;
    });

    it('setTargeting should be called if targeting contains key-values', async () => {
      const step = gptConfigure({
        ...emptyConfig,
        targeting: {
          keyValues: {
            foo: 'bar',
            tags: ['one', 'two']
          }
        }
      });
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      await step(adPipelineContext(), []);
      expect(setTargetingSpy).to.have.been.calledTwice;
      expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
      expect(setTargetingSpy).to.have.been.calledWith('tags', ['one', 'two']);
    });

    it('setTargeting should not be called if targeting key-value is excluded', async () => {
      const step = gptConfigure({
        ...emptyConfig,
        targeting: {
          keyValues: {
            foo: 'bar',
            sensitive: 'chocolate'
          },
          adManagerExcludes: ['sensitive']
        }
      });
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      await step(adPipelineContext(), []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
    });
  });

  describe('gptDestroyAdSlots', () => {
    it('should call googletag.destroySlots', () => {
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();

      return step(adPipelineContext(), []).then(() => {
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy.firstCall.args).to.have.length(0);
      });
    });

    it('should call googletag.destroySlots with existing slots if destroyAllAdSlots is set to false', async () => {
      const domId = 'slot-1';
      const googleSlot = googleAdSlotStub('', domId);
      sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot]);
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();

      await step(
        adPipelineContext('production', {
          ...emptyConfig,
          spa: { enabled: true, destroyAllAdSlots: false, validateLocation: 'href' }
        }),
        [createdAdSlot(domId), createdAdSlot('slot-2')]
      );
      expect(destroySlotsSpy).to.have.been.calledOnce;
      expect(destroySlotsSpy.firstCall.args).to.have.length(1);
      const destroyedSlots: googletag.IAdSlot[] = destroySlotsSpy.firstCall.args[0];
      expect(destroyedSlots).to.be.an('array');
      expect(destroyedSlots).to.have.length(1);
      expect(destroyedSlots[0]).to.deep.equals(googleSlot);
    });

    it('should only run once per requestAds cycle', async () => {
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();

      await step(adPipelineContext('production', emptyConfig, 1), []);
      await step(adPipelineContext('production', emptyConfig, 1), []);
      await step(adPipelineContext('production', emptyConfig, 2), []);
      await step(adPipelineContext('production', emptyConfig, 2), []);
      expect(destroySlotsSpy).to.have.been.calledTwice;
    });

    it('should only run on each requestAds cycle if destroyAllAdSlots is set to false', async () => {
      const domId = 'slot-1';
      const googleSlot = googleAdSlotStub('', domId);
      sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot]);
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();
      const config: Moli.MoliConfig = {
        ...emptyConfig,
        spa: { enabled: true, destroyAllAdSlots: false, validateLocation: 'href' }
      };

      await step(adPipelineContext('production', config, 1), [createdAdSlot(domId)]);
      await step(adPipelineContext('production', config, 1), [createdAdSlot(domId)]);
      await step(adPipelineContext('production', config, 2), [createdAdSlot(domId)]);
      await step(adPipelineContext('production', config, 2), [createdAdSlot(domId)]);
      expect(destroySlotsSpy).callCount(4);
    });
  });

  describe('gptResetTargeting', () => {
    it('should not call googletag.pubads.clearTargeting() in env test', async () => {
      const step = gptResetTargeting();
      const pubadsSpy = sandbox.spy(dom.window.googletag, 'pubads');
      await step(adPipelineContext('test'), []);
      expect(pubadsSpy).not.been.called;
    });

    it('should clear targeting targetings and then set new targetings', async () => {
      const step = gptResetTargeting();
      const configWithTargeting: Moli.MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {
            foo: 'bar',
            tags: ['car', 'truck']
          }
        }
      };
      const clearTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'clearTargeting');
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      await step(adPipelineContext('production', configWithTargeting), []);
      Sinon.assert.callOrder(clearTargetingSpy, setTargetingSpy);
      expect(clearTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledTwice;
      expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
      expect(setTargetingSpy).to.have.been.calledWith('tags', ['car', 'truck']);
    });

    it('should only be executed once per requestAds cycle', async () => {
      const step = gptResetTargeting();
      const clearTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'clearTargeting');
      await Promise.all([
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 2), []),
        step(adPipelineContext('production', emptyConfig, 2), [])
      ]);
      expect(clearTargetingSpy).to.have.been.calledTwice;
    });
  });

  describe('resolve adUnitPathVariables', () => {
    const step = gptDefineSlots();
    matchMediaStub.returns({ matches: true } as MediaQueryList);
    const adSlot: Moli.AdSlot = {
      domId: 'dom-id',
      adUnitPath: '/123/dom-id/{device}/{domain}',
      behaviour: { loaded: 'eager' },
      position: 'in-page',
      sizes: [],
      sizeConfig: []
    };
    const ctxWithAdUnitPathVars = (
      device: 'mobile' | 'desktop',
      domain: string
    ): AdPipelineContext => ({
      ...adPipelineContext(),
      adUnitPathVariables: { domain: domain, device: device }
    });
    const domain = 'example.com';

    it('should call googletag.defineAdSlot', async () => {
      const defineSlotsStub = sandbox.spy(dom.window.googletag, 'defineSlot');
      await step(ctxWithAdUnitPathVars('mobile', domain), [adSlot]);
      expect(defineSlotsStub).to.have.been.calledOnce;
      expect(defineSlotsStub.firstCall.args).to.have.length(3);
    });

    ['desktop' as const, 'mobile' as const].forEach(deviceLabel => {
      it(`should resolve adUnitPath with the appropriate device label ${deviceLabel}`, async () => {
        const defineSlotsStub = sandbox.spy(dom.window.googletag, 'defineSlot');
        await step(ctxWithAdUnitPathVars(deviceLabel, domain), [adSlot]);
        expect(defineSlotsStub).to.have.been.calledOnce;
        expect(defineSlotsStub.firstCall.args[0]).to.equals(`/123/dom-id/${deviceLabel}/${domain}`);
      });
    });

    it('should resolve adUnitPath with predefined adUnitPathVariables', async () => {
      const ctxWithLabelServiceStub = ctxWithAdUnitPathVars('mobile', 'test.org');

      const defineSlotsStub = sandbox.spy(dom.window.googletag, 'defineSlot');
      await step(ctxWithLabelServiceStub, [adSlot]);
      expect(defineSlotsStub).to.have.been.calledOnce;
      expect(defineSlotsStub.firstCall.args[0]).to.equals('/123/dom-id/mobile/test.org');
    });
  });

  describe('gptLDeviceLabelKeyValue', () => {
    const ctxWithLabelServiceStub = adPipelineContext('production', emptyConfig);
    const getSupportedLabelsStub = sandbox.stub(
      ctxWithLabelServiceStub.labelConfigService,
      'getSupportedLabels'
    );

    it('should set no device label if no valid device labels are available', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([]);

      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'mobile');
    });

    it('should set mobile as a device label', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile']);
      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'mobile');
    });

    it('should set desktop as a device label', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['desktop']);

      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'desktop');
    });

    it('should filter out irrelevant labels', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile', 'mobile-320', 'ix']);

      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'mobile');
    });

    it('should not call googletag.pubads.setTargeting in env test', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile']);

      await step(adPipelineContext('test'), []);
      expect(setTargetingSpy).to.have.not.been.called;
    });
  });

  describe('gptConsentKeyValue', () => {
    it('should set full if gdpr does not apply', async () => {
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      const step = gptConsentKeyValue();
      await step({ ...adPipelineContext(), tcData: tcDataNoGdpr }, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledOnceWithExactly('consent', 'full');
    });

    it('should set full if consent is available for all purposes', async () => {
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      const step = gptConsentKeyValue();
      await step(adPipelineContext(), []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledOnceWithExactly('consent', 'full');
    });

    ['1', '2', '3', '4', '7', '9', '10'].forEach(purpose => {
      it(`should set none if consent is missing for purpose ${purpose}`, async () => {
        const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
        const step = gptConsentKeyValue();
        const tcData = fullConsent();
        tcData.purpose.consents[purpose] = false;

        await step({ ...adPipelineContext(), tcData }, []);
        expect(setTargetingSpy).to.have.been.calledOnceWithExactly('consent', 'none');
      });
    });

    it('should not call googletag.pubads.setTargeting in env test', async () => {
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      const step = gptConsentKeyValue();
      await step(adPipelineContext('test'), []);
      expect(setTargetingSpy).to.have.not.been.called;
    });
  });

  describe('gptDefineSlots', () => {
    const adSlot: Moli.AdSlot = createdAdSlot('dom-id');

    describe('test mode', () => {
      it('should never call googletag.defineSlot ', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'defineSlot');
        await step(adPipelineContext('test'), [adSlot]);
        expect(defineSlotsSpy).to.have.not.been.called;
      });

      it('should never call googletag.display ', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'display');
        await step(adPipelineContext('test'), [adSlot]);
        expect(defineSlotsSpy).to.have.not.been.called;
      });

      it('should never call googletag.pubads ', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'pubads');
        await step(adPipelineContext('test'), [adSlot]);
        expect(defineSlotsSpy).to.have.not.been.called;
      });
    });

    describe('production mode', () => {
      it('should define in-page slots', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineSlotsStub = sandbox
          .stub(dom.window.googletag, 'defineSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        return step(adPipelineContext(), [adSlot]).then(slotDefinitions => {
          expect(defineSlotsStub).to.have.been.calledOnce;
          expect(defineSlotsStub).to.have.been.calledOnceWithExactly(
            adSlot.adUnitPath,
            adSlot.sizes,
            adSlot.domId
          );
          expect(addServiceSpy).to.have.been.calledOnce;
          expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
          expect(displaySpy).to.have.been.calledOnce;
          expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
          expect(slotDefinitions).to.have.length(1);
          expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
        });
      });

      it('should define out-of-page slots', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        return step(adPipelineContext(), [outOfPageAdSlot]).then(slotDefinitions => {
          expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
          expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(
            adSlot.adUnitPath,
            adSlot.domId
          );
          expect(addServiceSpy).to.have.been.calledOnce;
          expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
          expect(displaySpy).to.have.been.calledOnce;
          expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
          expect(slotDefinitions).to.have.length(1);
          expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
        });
      });

      it('should define out-of-page-interstitial slots', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-interstitial'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        return step(adPipelineContext(), [outOfPageAdSlot]).then(slotDefinitions => {
          expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
          expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 5);
          expect(addServiceSpy).to.have.been.calledOnce;
          expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
          expect(displaySpy).to.have.been.calledOnce;
          expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
          expect(slotDefinitions).to.have.length(1);
          expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
        });
      });

      it('should resolve if out-of-page-interstitial slot can not be defined', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-interstitial'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 5);
        expect(slotDefinitions).to.have.length(0);
      });

      it('should define out-of-page-top-anchor slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-top-anchor'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 2);
        expect(addServiceSpy).to.have.been.calledOnce;
        expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
        expect(displaySpy).to.have.been.calledOnce;
        expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
        expect(slotDefinitions).to.have.length(1);
        expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
      });

      it('should resolve if out-of-page-top-anchor slot can not be defined', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-top-anchor'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 2);
        expect(slotDefinitions).to.have.length(0);
      });

      it('should define out-of-page-bottom-anchor slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-bottom-anchor'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 3);
        expect(addServiceSpy).to.have.been.calledOnce;
        expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
        expect(displaySpy).to.have.been.calledOnce;
        expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
        expect(slotDefinitions).to.have.length(1);
        expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
      });

      it('should resolve if out-of-page-bottom-anchor slot can not be defined', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-bottom-anchor'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 3);
        expect(slotDefinitions).to.have.length(0);
      });

      it('should define a slot only once', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'defineSlot');
        // slot is already defined
        sandbox
          .stub(dom.window.googletag.pubads(), 'getSlots')
          .returns([googleAdSlotStub(adSlot.adUnitPath, adSlot.domId)]);

        await step(adPipelineContext(), [adSlot]);
        expect(defineSlotsSpy).to.have.not.been.called;
      });

      it('should call display only once', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const displaySpy = sandbox.spy(dom.window.googletag, 'display');
        // slot is already defined
        sandbox
          .stub(dom.window.googletag.pubads(), 'getSlots')
          .returns([googleAdSlotStub(adSlot.adUnitPath, adSlot.domId)]);

        await step(adPipelineContext(), [adSlot]);
        expect(displaySpy).to.have.not.been.called;
      });
    });

    it('should filter slots if the size config matches', async () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      const slotDefinitions = await step(adPipelineContext(), [adSlot]);
      expect(slotDefinitions).to.have.length(1);
    });

    it("should remove slots if the size config doesn't match", async () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: false } as MediaQueryList);

      const slotDefinitions = await step(adPipelineContext(), [adSlot]);
      expect(slotDefinitions).to.have.length(0);
    });

    it('should filter slots if the label configuration matches', async () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(true);

      const slotDefinitions = await step(context, [adSlot]);
      expect(slotDefinitions).to.have.length(1);
    });

    it("should remove slots if the label configuration doesn't match", async () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(false);

      const slotDefinitions = await step(context, [adSlot]);
      expect(slotDefinitions).to.have.length(0);
    });

    describe('collapseEmptyDiv configuration', () => {
      let adSlotStub: googletag.IAdSlot;
      let setCollapseEmptyDivSpy: Sinon.SinonSpy;

      beforeEach(() => {
        adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
      });

      const defineSlots = (collapseEmptyDiv?: boolean) => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);
        sandbox.stub(dom.window.googletag, 'defineSlot').returns(adSlotStub);

        const step = gptDefineSlots();
        const context = adPipelineContext();
        const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
        filterSlotStub.returns(true);

        return step(context, [{ ...adSlot, gpt: { collapseEmptyDiv } }]);
      };

      it('should set to true if undefined', async () => {
        await defineSlots(undefined);
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
      });

      it('should set to true if true', async () => {
        await defineSlots(true);
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
      });

      it('should set to false if false', async () => {
        await defineSlots(false);
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(false);
      });
    });
  });

  describe('gptRequestAds', () => {
    describe('test environment', () => {
      it('should not call googletag.pubads().refresh', async () => {
        const step = gptRequestAds();
        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        await step(adPipelineContext('test'), []);
        expect(refreshSpy).to.have.not.been.called;
      });
    });

    describe('production environment', () => {
      it('should not call googletag.pubads().refresh if slots are empty', async () => {
        const step = gptRequestAds();
        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        await step(adPipelineContext(), []);
        expect(refreshSpy).to.have.not.been.called;
      });

      it('should call googletag.pubads().refresh with the configured slots', async () => {
        const step = gptRequestAds();
        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');
        const slot: Moli.SlotDefinition = {
          adSlot: googleAdSlotStub('/123/content_1', 'slot-1'),
          moliSlot: createdAdSlot('slot-1')
        } as any;

        await step(adPipelineContext(), [slot]);
        expect(refreshSpy).to.have.been.calledOnce;
        expect(refreshSpy).to.have.been.calledOnceWithExactly([slot.adSlot]);
      });

      it('should call googletag.pubads().refresh with slots that are not throttled', async () => {
        const step = gptRequestAds();
        const ctx = adPipelineContext();

        const slot1: Moli.SlotDefinition = {
          adSlot: googleAdSlotStub('/123/content_1', 'slot-1'),
          moliSlot: createdAdSlot('slot-1')
        } as any;
        const slot2: Moli.SlotDefinition = {
          adSlot: googleAdSlotStub('/123/content_2', 'slot-2'),
          moliSlot: createdAdSlot('slot-2')
        } as any;

        const isThrottledStub = sandbox.stub(ctx.auction, 'isSlotThrottled');
        isThrottledStub.withArgs(slot1.moliSlot.domId, slot1.adSlot.getAdUnitPath()).returns(true);
        isThrottledStub.withArgs(slot2.moliSlot.domId, slot2.adSlot.getAdUnitPath()).returns(false);

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        await step(ctx, [slot1, slot2]);
        expect(isThrottledStub).to.have.been.calledTwice;
        expect(refreshSpy).to.have.been.calledOnce;
        expect(refreshSpy).to.have.been.calledOnceWithExactly([slot2.adSlot]);
      });
    });
  });
});
