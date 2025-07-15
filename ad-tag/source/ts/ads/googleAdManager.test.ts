import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { MoliRuntime } from '../types/moliRuntime';

import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from '../stubs/moliStubs';
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
import { createLabelConfigService } from './labelConfigService';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { fullConsent, tcData, tcDataNoGdpr, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { AdSlot, Environment, gpt, MoliConfig } from '../types/moliConfig';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('google ad manager', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const { dom, jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const adPipelineContext = (
    env: Environment = 'production',
    config: MoliConfig = emptyConfig,
    requestAdsCalls: number = 1
  ): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: requestAdsCalls,
      env__: env,
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow,
      labelConfigService__: createLabelConfigService([], [], jsDomWindow),
      tcData__: tcData,
      adUnitPathVariables__: { domain: 'example.com', device: 'mobile' },
      auction__: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService__: createAssetLoaderService(jsDomWindow)
    };
  };

  const matchMediaStub = sandbox.stub(jsDomWindow, 'matchMedia');
  const getElementByIdStub = sandbox.stub(jsDomWindow.document, 'getElementById');
  const createElementSpy = sandbox.spy(jsDomWindow.document, 'createElement');
  const appendChildSpy = sandbox.spy(jsDomWindow.document.body, 'appendChild');

  const sleep = (timeInMs: number = 20) =>
    new Promise(resolve => {
      setTimeout(resolve, timeInMs);
    });

  const createdAdSlot = (domId: string): AdSlot => ({
    domId: domId,
    adUnitPath: `/123/${domId}/{device}`,
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
    jsDomWindow.googletag = createGoogletagStub();
    dom.window.__tcfapi = tcfapiFunction(tcData);
    matchMediaStub.returns({ matches: true } as MediaQueryList);
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('gptInit', () => {
    it('should not load anything in test mode', async () => {
      const step = gptInit();
      await step(adPipelineContext('test'));
      expect(loadScriptStub).not.been.called;
    });
    it('should set the window.googletag', async () => {
      const step = gptInit();
      (dom.window as any).googletag = undefined;
      expect(dom.window.googletag).to.be.undefined;

      const init = step(adPipelineContext());
      await sleep();
      expect(dom.window.googletag).to.be.ok;
      (dom.window as any).googletag.cmd[0]();
      return init;
    });

    it('should set the window.google only once', async () => {
      const step = gptInit();
      (dom.window as any).googletag = undefined;
      expect(dom.window.googletag).to.be.undefined;

      const init = step(adPipelineContext());
      await sleep();
      (dom.window as any).googletag.cmd[0]();
      await init;
      return await step(adPipelineContext());
    });
  });

  describe('gptConfigure', () => {
    it('setTargeting should not be called if targeting is empty', async () => {
      const step = gptConfigure();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      await step(adPipelineContext(), []);
      expect(setTargetingSpy).to.have.not.been.called;
    });

    it('setTargeting should be called if targeting contains key-values', async () => {
      const step = gptConfigure();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      const configWithServerSideTargeting: MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {
            foo: 'bar',
            tags: ['one', 'two']
          }
        }
      };

      await step(adPipelineContext('production', configWithServerSideTargeting), []);
      expect(setTargetingSpy).to.have.been.calledTwice;
      expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
      expect(setTargetingSpy).to.have.been.calledWith('tags', ['one', 'two']);
    });

    it('setTargeting should not be called if targeting key-value is excluded', async () => {
      const step = gptConfigure();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      const configWithServerSideTargeting: MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {
            foo: 'bar',
            sensitive: 'chocolate'
          },
          adManagerExcludes: ['sensitive']
        }
      };

      await step(adPipelineContext('production', configWithServerSideTargeting), []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
    });
  });

  describe('gptDestroyAdSlots', () => {
    const domId1 = 'slot-1';
    const googleSlot1 = googleAdSlotStub('', domId1);
    describe('cleanup all', () => {
      it('should call googletag.destroySlots', async () => {
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();

        await step(adPipelineContext(), []);
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy.firstCall.args).to.have.length(0);
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
    });

    describe('cleanup requested', () => {
      it('should call googletag.destroySlots with existing slots if cleanup is set to requested', async () => {
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot1]);
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();

        await step(
          adPipelineContext('production', {
            ...emptyConfig,
            spa: { enabled: true, cleanup: { slots: 'requested' }, validateLocation: 'href' }
          }),
          [createdAdSlot(domId1), createdAdSlot('slot-2')]
        );
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy.firstCall.args).to.have.length(1);
        const destroyedSlots: googletag.IAdSlot[] = destroySlotsSpy.firstCall.args[0];
        expect(destroyedSlots).to.be.an('array');
        expect(destroyedSlots).to.have.length(1);
        expect(destroyedSlots[0]).to.deep.equals(googleSlot1);
      });

      it('should only run on each requestAds cycle if cleanup is set to requested', async () => {
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot1]);
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();
        const config: MoliConfig = {
          ...emptyConfig,
          spa: { enabled: true, cleanup: { slots: 'requested' }, validateLocation: 'href' }
        };

        await step(adPipelineContext('production', config, 1), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 1), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 2), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 2), [createdAdSlot(domId1)]);
        expect(destroySlotsSpy).callCount(4);
      });
    });

    describe('cleanup excluded', () => {
      it('should call googletag.destroySlots with existing slots if no excludes are defined', async () => {
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot1]);
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();

        const config: MoliConfig = {
          ...emptyConfig,
          spa: {
            enabled: true,
            cleanup: { slots: 'excluded', slotIds: [] },
            validateLocation: 'href'
          }
        };
        await step(adPipelineContext('production', config), [createdAdSlot(domId1)]);
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy).to.have.been.calledWith([googleSlot1]);
      });

      it('should call googletag.destroySlots with existing slots that are not in slotIds', async () => {
        const domId2 = 'slot-2';
        const googleSlot2 = googleAdSlotStub('', domId2);
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot1, googleSlot2]);
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();

        const config: MoliConfig = {
          ...emptyConfig,
          spa: {
            enabled: true,
            cleanup: { slots: 'excluded', slotIds: [domId1] },
            validateLocation: 'href'
          }
        };
        await step(adPipelineContext('production', config), [
          createdAdSlot(domId1),
          createdAdSlot(domId2)
        ]);
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy).to.have.been.calledWith([googleSlot2]);
      });

      it('should only run on each requestAds cycle if cleanup is set to excluded', async () => {
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([googleSlot1]);
        const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
        const step = gptDestroyAdSlots();
        const config: MoliConfig = {
          ...emptyConfig,
          spa: {
            enabled: true,
            cleanup: { slots: 'excluded', slotIds: [] },
            validateLocation: 'href'
          }
        };

        await step(adPipelineContext('production', config, 1), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 1), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 2), [createdAdSlot(domId1)]);
        await step(adPipelineContext('production', config, 2), [createdAdSlot(domId1)]);
        expect(destroySlotsSpy).callCount(2);
      });
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
      const configWithTargeting: MoliConfig = {
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
    const adSlot: AdSlot = {
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
      adUnitPathVariables__: { domain: domain, device: device }
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
    const getDeviceLabelStub = sandbox.stub(
      ctxWithLabelServiceStub.labelConfigService__,
      'getDeviceLabel'
    );

    it('should set mobile as a device label', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getDeviceLabelStub.returns('mobile');
      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'mobile');
    });

    it('should set desktop as a device label', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

      getDeviceLabelStub.returns('desktop');

      await step(ctxWithLabelServiceStub, []);
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledWith('device_label', 'desktop');
    });

    it('should not call googletag.pubads.setTargeting in env test', async () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getDeviceLabelStub.returns('mobile');

      await step(adPipelineContext('test'), []);
      expect(setTargetingSpy).to.have.not.been.called;
    });
  });

  describe('gptConsentKeyValue', () => {
    it('should set full if gdpr does not apply', async () => {
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      const step = gptConsentKeyValue();
      await step({ ...adPipelineContext(), tcData__: tcDataNoGdpr }, []);
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

        await step({ ...adPipelineContext(), tcData__: tcData }, []);
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
    const adSlot: AdSlot = createdAdSlot('dom-id');

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
      it('should define in-page slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineSlotsStub = sandbox
          .stub(dom.window.googletag, 'defineSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        const slotDefinitions = await step(adPipelineContext(), [adSlot]);
        expect(defineSlotsStub).to.have.been.calledOnce;
        expect(defineSlotsStub).to.have.been.calledOnceWithExactly(
          '/123/dom-id/mobile',
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

      it('should define interstitial slot if ad slot is in DOM', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);
        getElementByIdStub.returns({} as HTMLElement);

        const interstitialAdSlot: AdSlot = {
          ...adSlot,
          position: 'interstitial'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineSlotsStub = sandbox
          .stub(dom.window.googletag, 'defineSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        const slotDefinitions = await step(adPipelineContext(), [interstitialAdSlot]);
        expect(createElementSpy).to.have.not.been.called;
        expect(defineSlotsStub).to.have.been.calledOnce;
        expect(defineSlotsStub).to.have.been.calledOnceWithExactly(
          '/123/dom-id/mobile',
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

      it('should define interstitial slot if ad slot is not in DOM', async () => {
        const step = gptDefineSlots();

        matchMediaStub.returns({ matches: true } as MediaQueryList);
        getElementByIdStub.returns(null);

        const interstitialAdSlot: AdSlot = {
          ...adSlot,
          position: 'interstitial'
        };

        const adSlotStub = googleAdSlotStub(adSlot.adUnitPath, adSlot.domId);
        const addServiceSpy = sandbox.spy(adSlotStub, 'addService');
        const setCollapseEmptyDivSpy = sandbox.spy(adSlotStub, 'setCollapseEmptyDiv');
        const defineSlotsStub = sandbox
          .stub(dom.window.googletag, 'defineSlot')
          .returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        const slotDefinitions = await step(adPipelineContext(), [interstitialAdSlot]);
        // new dom element needs to be added
        expect(createElementSpy).to.have.been.calledOnce;
        const createdElement = createElementSpy.firstCall.returnValue;
        expect(createdElement).to.be.ok;
        expect(createdElement.id).to.be.equal(adSlot.domId);
        expect(createdElement.style.display).to.be.equal('none');
        expect(createdElement.attributes.getNamedItem('data-h5v-position')?.value).to.be.equal(
          'interstitial'
        );

        expect(defineSlotsStub).to.have.been.calledOnce;
        expect(defineSlotsStub).to.have.been.calledOnceWithExactly(
          '/123/dom-id/mobile',
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

      it('should define out-of-page slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: AdSlot = {
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

        let slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(
          '/123/dom-id/mobile',
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

      (['out-of-page', 'interstitial'] as gpt.Position[]).forEach(position => {
        it(`should create a div container for position ${position} if it does not exist`, async () => {
          const step = gptDefineSlots();
          matchMediaStub.returns({ matches: true } as MediaQueryList);

          const outOfPageAdSlot: AdSlot = { ...adSlot, position: position };

          await step(adPipelineContext(), [outOfPageAdSlot]);
          expect(createElementSpy).to.have.been.calledOnce;
          expect(createElementSpy).to.have.been.calledOnceWithExactly('div');
          const createdElement = createElementSpy.firstCall.returnValue;
          expect(createdElement.id).to.be.equal(adSlot.domId);
          expect(createdElement.style.display).to.be.equal('none');
          expect(createdElement.attributes.getNamedItem('data-h5v-position')?.value).to.be.equal(
            position
          );
          expect(appendChildSpy).to.have.been.calledOnce;
          expect(appendChildSpy).to.have.been.calledOnceWithExactly(createdElement);
        });

        it(`should not create a div container for position ${position} if the container already exists`, async () => {
          const step = gptDefineSlots();
          matchMediaStub.returns({ matches: true } as MediaQueryList);

          const outOfPageAdSlot: AdSlot = { ...adSlot, position: position };

          getElementByIdStub.returns({} as HTMLElement);
          await step(adPipelineContext(), [outOfPageAdSlot]);
          expect(createElementSpy).to.have.not.been.called;
          expect(appendChildSpy).to.have.not.been.called;
        });
      });

      it('should define out-of-page-interstitial slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: AdSlot = {
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

        let slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 5);
        expect(addServiceSpy).to.have.been.calledOnce;
        expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
        expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
        expect(displaySpy).to.have.been.calledOnce;
        expect(displaySpy).to.have.been.calledOnceWithExactly(adSlotStub);
        expect(slotDefinitions).to.have.length(1);
        expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
      });

      it('should resolve if out-of-page-interstitial slot can not be defined', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: AdSlot = {
          ...adSlot,
          position: 'out-of-page-interstitial'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 5);
        expect(slotDefinitions).to.have.length(0);
      });

      it('should define out-of-page-top-anchor slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: AdSlot = {
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
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 2);
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

        const outOfPageAdSlot: AdSlot = {
          ...adSlot,
          position: 'out-of-page-top-anchor'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 2);
        expect(slotDefinitions).to.have.length(0);
      });

      it('should define out-of-page-bottom-anchor slots', async () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: AdSlot = {
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
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 3);
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

        const outOfPageAdSlot: AdSlot = {
          ...adSlot,
          position: 'out-of-page-bottom-anchor'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        const slotDefinitions = await step(adPipelineContext(), [outOfPageAdSlot]);
        expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
        expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly('/123/dom-id/mobile', 3);
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

      const filterSlotStub = sandbox.stub(context.labelConfigService__, 'filterSlot');
      filterSlotStub.returns(true);

      const slotDefinitions = await step(context, [adSlot]);
      expect(slotDefinitions).to.have.length(1);
    });

    it("should remove slots if the label configuration doesn't match", async () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService__, 'filterSlot');
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
        const filterSlotStub = sandbox.stub(context.labelConfigService__, 'filterSlot');
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
        const slot = {
          adSlot: googleAdSlotStub('/123/content_1', 'slot-1'),
          moliSlot: createdAdSlot('slot-1')
        } as MoliRuntime.SlotDefinition;

        await step(adPipelineContext(), [slot]);
        expect(refreshSpy).to.have.been.calledOnce;
        expect(refreshSpy).to.have.been.calledOnceWithExactly([slot.adSlot]);
      });

      it('should call googletag.pubads().refresh with slots that are not throttled', async () => {
        const step = gptRequestAds();
        const ctx = adPipelineContext();

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');
        const slot1 = {
          adSlot: googleAdSlotStub('/123/content_1', 'slot-1'),
          moliSlot: createdAdSlot('slot-1')
        } as MoliRuntime.SlotDefinition;
        const slot2 = {
          adSlot: googleAdSlotStub('/123/content_2', 'slot-2'),
          moliSlot: createdAdSlot('slot-2')
        } as MoliRuntime.SlotDefinition;

        const isThrottledStub = sandbox.stub(ctx.auction__, 'isSlotThrottled');
        isThrottledStub.withArgs(slot1.moliSlot.domId, slot1.adSlot.getAdUnitPath()).returns(true);
        isThrottledStub.withArgs(slot2.moliSlot.domId, slot2.adSlot.getAdUnitPath()).returns(false);

        await step(ctx, [slot1, slot2]);
        expect(isThrottledStub).to.have.been.calledTwice;
        expect(refreshSpy).to.have.been.calledOnce;
        expect(refreshSpy).to.have.been.calledOnceWithExactly([slot2.adSlot]);
      });

      describe('interstitial position', () => {
        const moliInterstitialSlot: AdSlot = {
          ...createdAdSlot('content_1'),
          position: 'interstitial'
        };

        it('should use the existing slot if prebid demand is detected', async () => {
          const step = gptRequestAds();
          const slot: MoliRuntime.SlotDefinition = {
            adSlot: googleAdSlotStub('/123/content_1', 'content_1'),
            moliSlot: moliInterstitialSlot
          } as MoliRuntime.SlotDefinition;
          const getTargetingStub = sandbox
            .stub(slot.adSlot, 'getTargeting')
            .callsFake(key => (key === 'hb_pb' ? ['1.00'] : []));
          const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

          await step(adPipelineContext(), [slot]);
          expect(refreshSpy).to.have.been.calledOnce;
          expect(refreshSpy).to.have.been.calledOnceWithExactly([slot.adSlot]);
          expect(getTargetingStub).to.have.been.calledOnce;
          expect(getTargetingStub).to.have.been.calledOnceWithExactly('hb_pb');
        });

        it('should recreate the slot as out-of-page-interstitial if prebid demand is not detected', async () => {
          const step = gptRequestAds();
          const slot: MoliRuntime.SlotDefinition = {
            adSlot: googleAdSlotStub('/123/content_1/mobile', 'slot-1'),
            moliSlot: moliInterstitialSlot
          } as MoliRuntime.SlotDefinition;
          const getTargetingStub = sandbox.stub(slot.adSlot, 'getTargeting').returns([]);
          const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');
          const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
          const defineOutOfPageSlotSpy = sandbox.spy(dom.window.googletag, 'defineOutOfPageSlot');

          await step(adPipelineContext(), [slot]);
          expect(defineOutOfPageSlotSpy).to.have.been.calledOnce;
          expect(defineOutOfPageSlotSpy).to.have.been.calledOnceWithExactly(
            '/123/content_1/mobile',
            5
          );
          const newSlot = defineOutOfPageSlotSpy.firstCall.returnValue;

          expect(refreshSpy).to.have.been.calledOnce;
          expect(refreshSpy).to.have.been.calledOnceWithExactly([newSlot]);
          expect(getTargetingStub).to.have.been.calledOnce;
          expect(getTargetingStub).to.have.been.calledOnceWithExactly('hb_pb');
          expect(destroySlotsSpy).to.have.been.calledOnce;
          expect(destroySlotsSpy).to.have.been.calledOnceWithExactly([slot.adSlot]);
        });
      });
    });
  });
});
