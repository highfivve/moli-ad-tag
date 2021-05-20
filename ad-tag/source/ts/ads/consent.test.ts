import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { fullConsent, tcData, tcDataNoGdpr, tcfapiFunction } from '../stubs/consentStubs';
import { consentReady } from './consent';
import { noopLogger } from '../stubs/moliStubs';
import { tcfapi } from '../types/tcfapi';

use(sinonChai);
use(chaiAsPromised);

describe('consent', () => {
  const dom = createDom();
  const jsDomWindow: Window & tcfapi.TCFApiWindow = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const tcfapiFn = sandbox.stub();

  beforeEach(() => {
    jsDomWindow.__tcfapi = tcfapiFn;
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return TCDataNoGDPR for environment test', async () => {
    const tcdata = await consentReady(jsDomWindow, noopLogger, 'test');
    expect(tcdata.gdprApplies).to.be.false;
  });

  ['production' as const, undefined].forEach(env => {
    [tcfapi.status.EventStatus.TC_LOADED, tcfapi.status.EventStatus.USER_ACTION_COMPLETE].forEach(
      eventStatus => {
        it(`should return TCDataNoGDPR for environment ${env} and event ${eventStatus}`, async () => {
          const tcdataExpected: tcfapi.responses.TCData = {
            ...fullConsent(),
            eventStatus
          };
          tcfapiFn.onFirstCall().callsFake((cmd, version, callback) => {
            expect(cmd).to.be.equals('addEventListener');
            expect(version).to.be.equals(2);
            callback(tcdataExpected, true);
          });

          const tcdata = await consentReady(jsDomWindow, noopLogger, 'production');
          expect(tcdata.gdprApplies).to.be.true;
          expect(tcdataExpected).to.be.equals(tcdataExpected);
        });
      }
    );
  });

  it('should reject if __tcfapi is not defined', () => {
    jsDomWindow.__tcfapi = undefined;
    return expect(consentReady(jsDomWindow, noopLogger, 'production')).to.be.rejectedWith(
      'window.__tcfapi is not defined. Make sure that the stub code is inlined in the head tag'
    );
  });

  it('should reject if cmpStatus is error', () => {
    const tcdata: tcfapi.responses.TCData = {
      ...fullConsent(),
      cmpStatus: tcfapi.status.CmpStatus.ERROR
    };
    tcfapiFn.onFirstCall().callsFake((cmd, version, callback) => {
      expect(cmd).to.be.equals('addEventListener');
      expect(version).to.be.equals(2);
      callback(tcdata, true);
    });

    return expect(consentReady(jsDomWindow, noopLogger, 'production')).to.be.rejected;
  });
});
