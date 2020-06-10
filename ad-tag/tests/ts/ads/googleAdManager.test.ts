import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext, } from '../../../source/ts/ads/adPipeline';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import {
  gptDefineSlots,
  gptDestroyAdSlots,
  gptInit,
  gptLDeviceLabelKeyValue,
  gptResetTargeting
} from '../../../source/ts/ads/googleAdManager';
import { noopReportingService } from '../../../source/ts/ads/reportingService';
import { LabelConfigService } from '../../../source/ts/ads/labelConfigService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('google ad manager', () => {

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const adPipelineContext = (env: Moli.Environment = 'production', config: Moli.MoliConfig = emptyConfig): AdPipelineContext => {
    return {
      requestId: 0,
      env: env,
      logger: noopLogger,
      config: config,
      window: dom.window,
      labelConfigService: new LabelConfigService([], [], dom.window),
      reportingService: noopReportingService,
      slotEventService: new SlotEventService(noopLogger)
    };
  };

  const matchMediaStub = sandbox.stub(dom.window, 'matchMedia');

  const sleep = (timeInMs: number = 20) => new Promise(resolve => {
    setTimeout(resolve, timeInMs);
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    // reset the before each test
    dom.window.googletag = createGoogletagStub();
    matchMediaStub.returns({ matches: true } as MediaQueryList);
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('gptInit', () => {

    it('should set the window.google', () => {
      const step = gptInit();
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
      const step = gptInit();
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

    it('should call removeAllEventSources on the slotEventService', () => {
      const context = adPipelineContext();
      const removeAllEventSourcesSpy = sandbox.spy(context.slotEventService, 'removeAllEventSources');
      const step = gptDestroyAdSlots();

      return step(context, []).then(() => {
        expect(removeAllEventSourcesSpy).to.have.been.calledOnce;
        expect(removeAllEventSourcesSpy).to.have.been.calledOnceWithExactly(dom.window);
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
            tags: [ 'car', 'truck' ]
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
        expect(setTargetingSpy).to.have.been.calledWith('tags', [ 'car', 'truck' ]);
      });
    });

  });

  describe('gptLDeviceLabelKeyValue', () => {

    const ctxWithLabelServiceStub = adPipelineContext('production', emptyConfig);
    const getSupportedLabelsStub = sandbox.stub(ctxWithLabelServiceStub.labelConfigService, 'getSupportedLabels');

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
      getSupportedLabelsStub.returns([ 'mobile', 'tablet' ]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should set mobile as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([ 'mobile' ]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', [ 'mobile' ]);
      });
    });

    it('should set tablet as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([ 'tablet' ]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', [ 'tablet' ]);
      });
    });

    it('should set desktop as a device label', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([ 'desktop' ]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', [ 'desktop' ]);
      });
    });

    it('should filter out irrelevant labels', () => {
      const step = gptLDeviceLabelKeyValue();
      const setTargetingSpy = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');
      getSupportedLabelsStub.returns([ 'mobile', 'mobile-320', 'ix' ]);

      return step(ctxWithLabelServiceStub, []).then(() => {
        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWith('device_label', [ 'mobile' ]);
      });
    });

  });

  describe('gptDefineSlots', () => {

    const adSlot: Moli.AdSlot = {
      domId: 'dom-id',
      adUnitPath: '/123/dom-id',
      behaviour: { loaded: 'eager' },
      position: 'in-page',
      sizes: [ [ 300, 250 ] ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [ [ 300, 250 ] ]
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
        const defineSlotsStub = sandbox.stub(dom.window.googletag, 'defineSlot').returns(adSlotStub);
        const displaySpy = sandbox.spy(dom.window.googletag, 'display');

        return step(adPipelineContext(), [ adSlot ]).then(slotDefinitions => {
          expect(defineSlotsStub).to.have.been.calledOnce;
          expect(defineSlotsStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(addServiceSpy).to.have.been.calledOnce;
          expect(addServiceSpy).to.have.been.calledOnceWithExactly(dom.window.googletag.pubads());
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnce;
          expect(setCollapseEmptyDivSpy).to.have.been.calledOnceWithExactly(true);
          expect(displaySpy).to.have.been.calledOnce;
          expect(displaySpy).to.have.been.calledOnceWithExactly(adSlot.domId);
          expect(slotDefinitions).to.have.length(1);
          expect(slotDefinitions[0].adSlot).to.be.equal(adSlotStub);
        });
      });

      it('should define a slot only once', () => {
        const step = gptDefineSlots();
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const defineSlotsSpy = sandbox.spy(dom.window.googletag, 'defineSlot');
        // slot is already defined
        sandbox.stub(dom.window.googletag.pubads(), 'getSlots').returns([
          googleAdSlotStub(adSlot.adUnitPath, adSlot.domId)
        ]);

        return step(adPipelineContext(), [ adSlot ]).then(slotDefinitions => {
          expect(defineSlotsSpy).to.have.not.been.called;
        });
      });


    });

    it('should filter slots if the size config matches', () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      return step(adPipelineContext(), [ adSlot ]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(1);
      });
    });

    it('should remove slots if the size config doesn\'t match', () => {
      const step = gptDefineSlots();
      matchMediaStub.returns({ matches: false } as MediaQueryList);

      return step(adPipelineContext(), [ adSlot ]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(0);
      });
    });

    it('should filter slots if the label configuration matches', () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(true);

      return step(context, [ adSlot ]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(1);
      });
    });

    it('should remove slots if the label configuration doesn\'t match', () => {
      const step = gptDefineSlots();
      const context = adPipelineContext();

      const filterSlotStub = sandbox.stub(context.labelConfigService, 'filterSlot');
      filterSlotStub.returns(false);

      return step(context, [ adSlot ]).then(slotDefinitions => {
        expect(slotDefinitions).to.have.length(0);
      });
    });

  });
});

