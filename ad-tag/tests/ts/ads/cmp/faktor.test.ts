import { dom } from '../../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { FaktorCmp } from '../../../../source/ts/ads/cmp/faktor';
import { ReportingService } from '../../../../source/ts/ads/reportingService';
import { SlotEventService } from '../../../../source/ts/ads/slotEventService';
import { createPerformanceService } from '../../../../source/ts/util/performanceService';
import { Moli } from '../../../../source/ts/types/moli';
import ReportingConfig = Moli.reporting.ReportingConfig;
import { noopLogger } from '../../stubs/moliStubs';

// setup sinon-chai
use(sinonChai);

describe('Faktor CMP', () => {
  const sandbox = Sinon.createSandbox();

  const reportingConfig: ReportingConfig = { sampleRate: 0, reporters: [] };

  const reportingService = new ReportingService(createPerformanceService(dom.window), new SlotEventService(noopLogger), reportingConfig, noopLogger, 'production', dom.window);

  const cmpStub = sandbox.stub();

  const addStubBehaviour = (onCall: number, returnValue?: boolean) => {
    // @ts-ignore TS7031
    cmpStub.onCall(onCall).callsFake((command, param, callback) => callback(returnValue));
  };

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  it('should not load the cmpFactorStub if faktor cmp is not initialized', () => {
    return expect(dom.window.__cmp).to.be.undefined;
  });

  it('should load the cmpFactorStub if faktor cmp is initialized', () => {
    new FaktorCmp(reportingService, noopLogger, dom.window);
    return expect(dom.window.__cmp).not.to.be.undefined;
  });

  it('should not call acceptAll if consent data exists', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    addStubBehaviour(1, true);
    const faktorCmp = new FaktorCmp(reportingService, noopLogger, dom.window);

    return faktorCmp.autoOptIn().then(() => {
      expect(cmpStub.callCount).to.equal(2);
      expect(cmpStub.secondCall.args[0]).to.equal('consentDataExist');
      expect(cmpStub.secondCall.args[1]).to.equal(true);
    });
  });

  it('should call acceptAll if no consent data exists', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    addStubBehaviour(1, false);
    addStubBehaviour(2);
    const faktorCmp = new FaktorCmp(reportingService, noopLogger, dom.window);

    return faktorCmp.autoOptIn().then(() => {
      expect(cmpStub.callCount).to.equal(3);
      expect(cmpStub.secondCall.args[0]).to.equal('consentDataExist');
      expect(cmpStub.secondCall.args[1]).to.equal(true);
      expect(cmpStub.thirdCall.args[0]).to.equal('acceptAll');
      expect(cmpStub.thirdCall.args[1]).to.equal(true);
    });
  });
});

// tslint:enable
