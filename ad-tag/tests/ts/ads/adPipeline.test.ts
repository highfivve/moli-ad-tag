import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import {
  AdPipeline,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep,
  mkPrepareRequestAdsStep
} from '../../../source/ts/ads/adPipeline';
import { reportingServiceStub } from '../stubs/reportingServiceStub';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../../../source/ts/types/googletag';
import { prebidjs } from '../../../source/ts/types/prebidjs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('AdPipeline', () => {
  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };

  const adSlot: Moli.AdSlot = {
    domId: 'dom-id',
    adUnitPath: '/123/dom-id',
    behaviour: { loaded: 'eager' },
    position: 'in-page',
    sizes: [],
    sizeConfig: []
  };

  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const reportingService = reportingServiceStub();
  const slotEventService = new SlotEventService(noopLogger);

  // create a new DfpService for testing
  const newAdPipeline = (config: IAdPipelineConfiguration): AdPipeline => {
    return new AdPipeline(config, noopLogger, jsDomWindow, reportingService, slotEventService);
  };

  const getElementByIdStub = sandbox.stub(dom.window.document, 'getElementById');

  const sleep = (timeInMs: number = 20) =>
    new Promise(resolve => {
      setTimeout(resolve, timeInMs);
    });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    // by default all DOM elements exist
    getElementByIdStub.returns({} as HTMLElement);
    dom.window.__tcfapi = tcfapiFunction(tcData);
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('run', () => {
    it('should not run when the slots array is empty', () => {
      let callCount: number = 0;
      const initSteps: InitStep[] = [
        () => {
          callCount = callCount + 1;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });
      return pipeline.run([], emptyConfig, 1).then(() => {
        expect(callCount).to.be.equals(0);
      });
    });

    it('should fail if the init phase fails', () => {
      const pipeline = newAdPipeline({
        ...emptyPipelineConfig,
        init: [() => Promise.reject('init failed')]
      });
      return expect(pipeline.run([adSlot], emptyConfig, 1)).eventually.be.rejectedWith(
        'init failed'
      );
    });

    it('should run the init phase only once', () => {
      let callCount: number = 0;
      const initSteps: InitStep[] = [
        () => {
          callCount = callCount + 1;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });

      return pipeline
        .run([adSlot], emptyConfig, 1)
        .then(() => {
          expect(callCount).to.be.equals(1);
          return pipeline.run([adSlot], emptyConfig, 1);
        })
        .then(() => {
          expect(callCount).to.be.equals(1);
        });
    });

    it('should execute prepareRequestAds by priority', () => {
      const spyFn = sandbox.spy();

      // higher priority / earlier execution
      const prepareRequestAdsSteps = [
        mkPrepareRequestAdsStep('first', 3, () => sleep(20).then(() => spyFn('1', 'priority 3'))),
        mkPrepareRequestAdsStep('second', 2, () => sleep(5).then(() => spyFn('2', 'priority 2'))),
        mkPrepareRequestAdsStep('third', 1, () => sleep(10).then(() => spyFn('3', 'priority 1')))
      ];

      const pipeline = newAdPipeline({
        ...emptyPipelineConfig,
        prepareRequestAds: prepareRequestAdsSteps
      });

      return pipeline.run([adSlot], emptyConfig, 1).then(() => {
        expect(spyFn).to.have.been.calledThrice;
        expect(spyFn.firstCall).calledWithExactly('1', 'priority 3');
        expect(spyFn.secondCall).calledWithExactly('2', 'priority 2');
        expect(spyFn.thirdCall).calledWithExactly('3', 'priority 1');
      });
    });
  });

  describe('pipeline context', () => {
    it('should contain an auto incremented request id', () => {
      let requestId: number | undefined;
      const configureStep: ConfigureStep[] = [
        context => {
          requestId = context.requestId;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, configure: configureStep });

      return pipeline
        .run([adSlot], emptyConfig, 1)
        .then(() => {
          expect(requestId).to.be.equals(1);
          return pipeline.run([adSlot], emptyConfig, 1);
        })
        .then(() => {
          expect(requestId).to.be.equals(2);
        });
    });
  });
});
