import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import SourcepointCmp from './index';
import { AdPipelineContext, Moli, tcfapi } from '@highfivve/ad-tag';
import { createDom } from '@highfivve/ad-tag/lib/tests/ts/stubs/browserEnvSetup';
import { newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/tests/ts/stubs/moliStubs';
import { LabelConfigService } from '@highfivve/ad-tag/lib/source/ts/ads/labelConfigService';
import { SlotEventService } from '@highfivve/ad-tag/lib/source/ts/ads/slotEventService';
import { createGoogletagStub } from '@highfivve/ad-tag/lib/tests/ts/stubs/googletagStubs';
import { noopReportingService } from '@highfivve/ad-tag/lib/source/ts/ads/reportingService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('Sourcepoint CMP Module', () => {
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;
  const cmpFunction = (returnValue: any) => (
    cmd: string,
    params: any,
    callback: Function
  ): void => {
    callback(returnValue);
  };

  const tcfApiWindow: tcfapi.TCFApiWindow = (jsDomWindow as unknown) as tcfapi.TCFApiWindow;

  const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      labelConfigService: new LabelConfigService([], [], jsDomWindow),
      reportingService: noopReportingService,
      slotEventService: new SlotEventService(noopLogger)
    };
  };

  afterEach(() => {
    sandbox.reset();
    tcfApiWindow.__tcfapi = null as any;
  });

  describe('init step', () => {
    it('should add the init step', () => {
      tcfApiWindow.__tcfapi = cmpFunction({ eventStatus: 'useractioncomplete' });
      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      expect(config.pipeline).to.be.ok;
      const initStep = config.pipeline!.initSteps[0];
      expect(initStep).to.be.ok;
      expect(initStep.name).to.be.equals('cmp-consent-ready');
    });

    it('should wait for the event status useractioncomplete', () => {
      tcfApiWindow.__tcfapi = cmpFunction({ eventStatus: 'useractioncomplete' });
      const cmpSpy = sandbox.spy(tcfApiWindow, '__tcfapi');

      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);
      const initStep = config.pipeline!.initSteps[0];

      return initStep(adPipelineContext(config)).then(() => {
        expect(cmpSpy).to.have.been.calledOnce;
        expect(cmpSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.same('addEventListener'),
          Sinon.match.same(2),
          Sinon.match.func
        );
      });
    });

    it('should wait for the event status tcloaded', () => {
      tcfApiWindow.__tcfapi = cmpFunction({ eventStatus: 'tcloaded' });
      const cmpSpy = sandbox.spy(tcfApiWindow, '__tcfapi');

      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);
      const initStep = config.pipeline!.initSteps[0];

      return initStep(adPipelineContext(config)).then(() => {
        expect(cmpSpy).to.have.been.calledOnce;
        expect(cmpSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.same('addEventListener'),
          Sinon.match.same(2),
          Sinon.match.func
        );
      });
    });
  });

  describe('prepareRequestAdsSteps', () => {
    const setRequestNonPersonalizedAdsSpy = () => {
      return sandbox.spy(jsDomWindow.googletag.pubads(), 'setRequestNonPersonalizedAds');
    };

    beforeEach(() => {
      tcfApiWindow.__tcfapi = cmpFunction({ eventStatus: 'useractioncomplete' });
      jsDomWindow.googletag = createGoogletagStub();
    });

    it('should add the prepareRequestAdsSteps step', () => {
      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      expect(config.pipeline).to.be.ok;
      const prepareRequestAdsStep = config.pipeline!.prepareRequestAdsSteps[0];
      expect(prepareRequestAdsStep).to.be.ok;
      expect(prepareRequestAdsStep.name).to.be.equals('cmp-gpt-personalized-ads');
    });

    it('should setRequestNonPersonalizedAds(0) === personalized ads if required purposes are set', () => {
      const npaSpy = setRequestNonPersonalizedAdsSpy();

      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      const prepareRequestAdsStep = config.pipeline!.prepareRequestAdsSteps[0];
      tcfApiWindow.__tcfapi = cmpFunction({
        purpose: { consents: { 1: true, 3: true, 4: true } }
      });

      return prepareRequestAdsStep(adPipelineContext(config), []).then(() => {
        expect(npaSpy).to.have.been.calledWith(0);
      });
    });

    it('should setRequestNonPersonalizedAds(1) === personalized ads if purpose one is set', () => {
      const npaSpy = setRequestNonPersonalizedAdsSpy();

      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      const prepareRequestAdsStep = config.pipeline!.prepareRequestAdsSteps[0];
      tcfApiWindow.__tcfapi = cmpFunction({
        purpose: { consents: { 1: true, 3: false, 4: false } }
      });

      return prepareRequestAdsStep(adPipelineContext(config), []).then(() => {
        expect(npaSpy).to.have.been.calledWith(1);
      });
    });

    it('should resolve the promise if rejectOnMissingPurposeOne is set to false', () => {
      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: false }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      const prepareRequestAdsStep = config.pipeline!.prepareRequestAdsSteps[0];
      tcfApiWindow.__tcfapi = cmpFunction({
        purpose: { consents: { 1: false, 3: false, 4: false } }
      });

      return expect(prepareRequestAdsStep(adPipelineContext(config), [])).eventually.be.fulfilled;
    });

    it('should reject the promise if rejectOnMissingPurposeOne is set to true', () => {
      const cmp = new SourcepointCmp({ rejectOnMissingPurposeOne: true }, jsDomWindow);
      const config = newEmptyConfig();

      cmp.init(config);

      const prepareRequestAdsStep = config.pipeline!.prepareRequestAdsSteps[0];
      tcfApiWindow.__tcfapi = cmpFunction({
        purpose: { consents: { 1: false, 3: false, 4: false } }
      });

      return expect(
        prepareRequestAdsStep(adPipelineContext(config), [])
      ).eventually.be.rejectedWith('No consents for purpose 1. Ad delivery prohibited by Google');
    });
  });
});
