import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import { SlotEventService } from './slotEventService';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import {
  gptConsentKeyValue,
  gptDefineSlots,
  gptDestroyAdSlots,
  gptInit,
  gptLDeviceLabelKeyValue,
  gptResetTargeting
} from './googleAdManager';
import { noopReportingService } from './reportingService';
import { LabelConfigService } from './labelConfigService';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('google ad manager', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow = dom.window as any;

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
      slotEventService: new SlotEventService(noopLogger),
      tcData: tcData
    };
  };

  const matchMediaStub = sandbox.stub(dom.window, 'matchMedia');

  const sleep = (timeInMs: number = 20) =>
    new Promise(resolve => {
      setTimeout(resolve, timeInMs);
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

  describe('gptDestroyAdSlots', () => {
    it('should call googletag.destroySlots', () => {
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();

      return step(adPipelineContext(), []).then(() => {
        expect(destroySlotsSpy).to.have.been.calledOnce;
        expect(destroySlotsSpy.firstCall.args).to.have.length(0);
      });
    });

    it('should only run once per requestAds cycle', () => {
      const destroySlotsSpy = sandbox.spy(dom.window.googletag, 'destroySlots');
      const step = gptDestroyAdSlots();

      return Promise.all([
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 2), []),
        step(adPipelineContext('production', emptyConfig, 2), [])
      ]).then(() => {
        expect(destroySlotsSpy).to.have.been.calledTwice;
      });
    });
  });

  describe('gptResetTargeting', () => {
    it('should do nothing in test mode', () => {
      const step = gptResetTargeting();
      const pubadsSpy = sandbox.spy(dom.window.googletag, 'pubads');
      return step(adPipelineContext('test'), []).then(() => {
        expect(pubadsSpy).not.been.called;
      });
    });

    it('should clear targeting targetings and then set new targetings', () => {
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
      return step(adPipelineContext('production', configWithTargeting), []).then(() => {
        Sinon.assert.callOrder(clearTargetingSpy, setTargetingSpy);
        expect(clearTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledTwice;
        expect(setTargetingSpy).to.have.been.calledWith('foo', 'bar');
        expect(setTargetingSpy).to.have.been.calledWith('tags', ['car', 'truck']);
      });
    });

    it('should only be executed once per requestAds cycle', () => {
      const step = gptResetTargeting();
      const clearTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'clearTargeting');

      return Promise.all([
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 1), []),
        step(adPipelineContext('production', emptyConfig, 2), []),
        step(adPipelineContext('production', emptyConfig, 2), [])
      ]).then(() => {
        expect(clearTargetingSpy).to.have.been.calledTwice;
      });
    });
  });

  describe('gptLDeviceLabelKeyValue', () => {
    const ctxWithLabelServiceStub = adPipelineContext('production', emptyConfig);
    const getSupportedLabelsStub = sandbox.stub(
      ctxWithLabelServiceStub.labelConfigService,
      'getSupportedLabels'
    );

    it('should set no device label if no valid device labels are available', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should set no device label if more than one valid device labels are available', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile', 'tablet']);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should set mobile as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile']);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', ['mobile']);
      });
    });

    it('should set tablet as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['tablet']);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', ['tablet']);
      });
    });

    it('should set desktop as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['desktop']);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', ['desktop']);
      });
    });

    it('should filter out irrelevant labels', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns(['mobile', 'mobile-320', 'ix']);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', ['mobile']);
      });
    });
  });

  describe('gptConsentKeyValue', () => {
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
        const context = adPipelineContext();
        context.tcData.purpose.consents[purpose] = false;
        await step(context, []);
        expect(setTargetingSpy).to.have.been.calledOnceWithExactly('consent', 'none');
      });
    });
  });

  describe('gptDefineSlots', () => {
    const adSlot: Moli.AdSlot = {
      domId: 'dom-id',
      adUnitPath: '/123/dom-id',
      behaviour: { loaded: 'eager' },
      position: 'in-page',
      sizes: [[300, 250]],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 250]]
        }
      ]
    };

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

      it('should resolve if out-of-page-interstitial slot can not be defined', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const outOfPageAdSlot: Moli.AdSlot = {
          ...adSlot,
          position: 'out-of-page-interstitial'
        };

        const defineOutOfPageSlotStub = sandbox
          .stub(dom.window.googletag, 'defineOutOfPageSlot')
          .returns(null);

        return step(adPipelineContext(), [outOfPageAdSlot]).then(slotDefinitions => {
          expect(defineOutOfPageSlotStub).to.have.been.calledOnce;
          expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, 5);
          expect(slotDefinitions).to.have.length(0);
        });
      });

      it('should define a slot only once', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'defineSlot');
        // slot is already defined
        sandbox
          .stub(dom.window.googletag.pubads(), 'getSlots')
          .returns([googleAdSlotStub(adSlot.adUnitPath, adSlot.domId)]);

        return step(adPipelineContext(), [adSlot]).then(_ => {
          expect(defineSlotsSpy).to.have.not.been.called;
        });
      });

      it('should call display only once', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const displaySpy = sandbox.spy(dom.window.googletag, 'display');
        // slot is already defined
        sandbox
          .stub(dom.window.googletag.pubads(), 'getSlots')
          .returns([googleAdSlotStub(adSlot.adUnitPath, adSlot.domId)]);

        return step(adPipelineContext(), [adSlot]).then(_ => {
          expect(displaySpy).to.have.not.been.called;
        });
      });
    });

    it('should filter slots if the size config matches', () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      return step(adPipelineContext(), [adSlot]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(1);
      });
    });

    it("should remove slots if the size config doesn't match", () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: false } as MediaQueryList);

      return step(adPipelineContext(), [adSlot]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(0);
      });
    });

    it('should filter slots if the label configuration matches', () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(true);

      return step(context, [adSlot]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(1);
      });
    });

    it("should remove slots if the label configuration doesn't match", () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(false);

      return step(context, [adSlot]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(0);
      });
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

      it('should set to true if undefined', () => {
        return defineSlots(undefined).then(() => {
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
        });
      });

      it('should set to true if true', () => {
        return defineSlots(true).then(() => {
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
        });
      });

      it('should set to false if false', () => {
        return defineSlots(false).then(() => {
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(false);
        });
      });
    });
  });
});
