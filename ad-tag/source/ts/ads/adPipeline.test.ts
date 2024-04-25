import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import {
  AdPipeline,
  AdPipelineContext,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep,
  mkConfigureStepOnce,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from './adPipeline';
import { reportingServiceStub } from '../stubs/reportingServiceStub';
import { fullConsent, tcData, tcDataNoGdpr, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { LabelConfigService } from './labelConfigService';
import { noopReportingService } from './reportingService';
import MoliConfig = Moli.MoliConfig;
import SlotDefinition = Moli.SlotDefinition;
import { dummySupplyChainNode } from '../stubs/schainStubs';
import { GlobalAuctionContext } from './globalAuctionContext';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

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
  const jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const reportingService = reportingServiceStub();

  // create a new DfpService for testing
  const newAdPipeline = (config: IAdPipelineConfiguration): AdPipeline => {
    return new AdPipeline(
      config,
      noopLogger,
      jsDomWindow,
      reportingService,
      new GlobalAuctionContext(jsDomWindow)
    );
  };

  const adPipelineContext = (
    requestAdsCalls: number = 1,
    requestId: number = 1,
    env: Moli.Environment = 'production',
    config: Moli.MoliConfig = emptyConfig
  ): AdPipelineContext => {
    return {
      requestId,
      requestAdsCalls: requestAdsCalls,
      env: env,
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      labelConfigService: new LabelConfigService([], [], jsDomWindow),
      reportingService: noopReportingService,
      tcData: tcData,
      adUnitPathVariables: { domain: 'example.com', device: 'mobile' },
      auction: new GlobalAuctionContext(jsDomWindow)
    };
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
    it('should not run when the slots array is empty', async () => {
      let callCount: number = 0;
      const initSteps: InitStep[] = [
        () => {
          callCount = callCount + 1;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });
      await pipeline.run([], emptyConfig, 1);
      expect(callCount).to.be.equals(0);
    });

    it('should use the proper timeout', () => {
      let timeout: number | undefined = 0;
      const initSteps: InitStep[] = [
        context => {
          timeout = context.bucket?.timeout;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });
      pipeline
        .run(
          [adSlot],
          {
            ...emptyConfig,
            buckets: { enabled: true, bucket: { one: { timeout: 3000 }, two: { timeout: 1500 } } }
          },
          1,
          'one'
        )
        .then(() => {
          expect(timeout).to.be.equals(3000);
        });
    });

    it('should use the default timeout', () => {
      let timeout: number | undefined = 0;
      const initSteps: InitStep[] = [
        context => {
          timeout = context.bucket?.timeout;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });
      pipeline
        .run(
          [adSlot],
          {
            ...emptyConfig,
            buckets: { enabled: true, bucket: { one: { timeout: 3000 } } }
          },
          1,
          'bla'
        )
        .then(() => {
          expect(timeout).not.to.equals(3000);
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

    it('should run the init phase only once', async () => {
      let callCount: number = 0;
      const initSteps: InitStep[] = [
        () => {
          callCount = callCount + 1;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: initSteps });
      await pipeline.run([adSlot], emptyConfig, 1);
      expect(callCount).to.be.equals(1);
      await pipeline.run([adSlot], emptyConfig, 1);
      expect(callCount).to.be.equals(1);
    });

    it('should abort running the ad pipeline if no slots are available after filtering', async () => {
      let callCount: number = 0;
      const initSteps: InitStep[] = [
        () => {
          callCount = callCount + 1;
          return Promise.resolve();
        }
      ];
      const prepareRequestAdsStub = sandbox.stub();
      const prepareRequestAdsSteps: PrepareRequestAdsStep[] = [
        mkPrepareRequestAdsStep('prepare-stub', 1, () => {
          prepareRequestAdsStub();
          return Promise.resolve();
        })
      ];
      const pipeline = newAdPipeline({
        ...emptyPipelineConfig,
        init: initSteps,
        prepareRequestAds: prepareRequestAdsSteps
      });

      const config: MoliConfig = {
        slots: [adSlot],
        schain: {
          supplyChainStartNode: dummySupplyChainNode
        }
      };

      await expect(pipeline.run([adSlot], config, 1)).to.eventually.be.fulfilled;

      expect(callCount).to.be.equals(1);
      expect(prepareRequestAdsStub).to.not.have.been.called;
    });

    it('should execute prepareRequestAds by priority', async () => {
      const spyFn = sandbox.spy();

      // higher priority / earlier execution
      const prepareRequestAdsSteps = [
        mkPrepareRequestAdsStep('first', 3, () => sleep(20).then(() => spyFn('1', 'priority 3'))),
        mkPrepareRequestAdsStep('second', 2, () => sleep(5).then(() => spyFn('2', 'priority 2'))),
        mkPrepareRequestAdsStep('third', 1, () => sleep(10).then(() => spyFn('3', 'priority 1')))
      ];

      const pipeline = newAdPipeline({
        ...emptyPipelineConfig,
        defineSlots: () => Promise.resolve([{ moliSlot: adSlot } as SlotDefinition]),
        prepareRequestAds: prepareRequestAdsSteps
      });
      await pipeline.run([adSlot], emptyConfig, 1);
      expect(spyFn).to.have.been.calledThrice;
      expect(spyFn.firstCall).calledWithExactly('1', 'priority 3');
      expect(spyFn.secondCall).calledWithExactly('2', 'priority 2');
      expect(spyFn.thirdCall).calledWithExactly('3', 'priority 1');
    });
  });

  describe('pipeline context', () => {
    it('should contain an auto incremented request id', async () => {
      let requestId: number | undefined;
      const configureStep: ConfigureStep[] = [
        context => {
          requestId = context.requestId;
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, configure: configureStep });
      await pipeline.run([adSlot], emptyConfig, 1);
      expect(requestId).to.be.equals(1);
      await pipeline.run([adSlot], emptyConfig, 1);
      expect(requestId).to.be.equals(2);
    });
  });

  describe('LabelService', () => {
    it('should contain purpose-1 label if consent for purpose 1 is given', async () => {
      let supportedLabels: string[] = [];
      const configureStep: ConfigureStep[] = [
        context => {
          supportedLabels = context.labelConfigService.getSupportedLabels();
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, configure: configureStep });
      await pipeline.run([adSlot], emptyConfig, 1);

      expect(supportedLabels).to.contain('purpose-1');
    });

    it('should not contain purpose-1 label if no consent for purpose 1 is given', async () => {
      const noPurpose1 = fullConsent();
      noPurpose1.purpose.consents['1'] = false;
      dom.window.__tcfapi = tcfapiFunction(noPurpose1);
      let supportedLabels: string[] = [];
      const configureStep: ConfigureStep[] = [
        context => {
          supportedLabels = context.labelConfigService.getSupportedLabels();
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, configure: configureStep });
      await pipeline.run([adSlot], emptyConfig, 1);

      expect(supportedLabels).to.not.contain('purpose-1');
    });

    it('should contain purpose-1 label if gdpr does not apply', async () => {
      dom.window.__tcfapi = tcfapiFunction(tcDataNoGdpr);
      let supportedLabels: string[] = [];
      const configureStep: ConfigureStep[] = [
        context => {
          supportedLabels = context.labelConfigService.getSupportedLabels();
          return Promise.resolve();
        }
      ];
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, configure: configureStep });
      await pipeline.run([adSlot], emptyConfig, 1);

      expect(supportedLabels).to.contain('purpose-1');
    });
  });

  describe('mkConfigureStepOnce', () => {
    it('should run the configure step on the first requestAds call with requestId 1', async () => {
      const stubFn = sandbox.stub().resolves();
      const step = mkConfigureStepOnce('step', stubFn);
      await step(adPipelineContext(1, 1), []);
      expect(stubFn).to.have.been.calledOnce;
    });

    it('should not run the configure step on the first requestAds call with requestId larger than 1', async () => {
      const stubFn = sandbox.stub().resolves();
      const step = mkConfigureStepOnce('step', stubFn);
      await step(adPipelineContext(1, 2), []);
      expect(stubFn).to.have.callCount(0);
    });

    it('should not run the configure step after the first requestAds call', async () => {
      const stubFn = sandbox.stub().resolves();
      const step = mkConfigureStepOnce('step', stubFn);
      await step(adPipelineContext(2, 1), []);
      expect(stubFn).to.have.callCount(0);
    });
  });
});
