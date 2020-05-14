import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import {
  AdPipeline, AdPipelineContext,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep
} from '../../../source/ts/ads/adPipeline';
import { reportingServiceStub } from '../stubs/reportingServiceStub';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { apstagStub } from '../stubs/a9Stubs';
import { createGoogletagStub } from '../stubs/googletagStubs';
import { gptDestroyAdSlots, gptInit, gptResetTargeting } from '../../../source/ts/ads/googleAdManager';
import { noopReportingService } from '../../../source/ts/ads/reportingService';
import { LabelConfigService } from '../../../source/ts/ads/labelConfigService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('google ad manager', () => {

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  let dom = createDom();
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

});

