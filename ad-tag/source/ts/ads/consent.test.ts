import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { fullConsent } from '../stubs/consentStubs';
import { consentReady, missingPurposeConsent } from './consent';
import { noopLogger } from '../stubs/moliStubs';
import { tcfapi } from '../types/tcfapi';
import { Moli } from '../types/moli';

const TCPurpose = tcfapi.responses.TCPurpose;

use(sinonChai);
use(chaiAsPromised);

describe('consent', () => {
  const dom = createDom();
  const jsDomWindow: Window & tcfapi.TCFApiWindow = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const tcfapiFn = sandbox.stub();

  const emptyConsentConfig: Moli.consent.ConsentConfig = {};

  beforeEach(() => {
    jsDomWindow.__tcfapi = tcfapiFn;
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return TCDataNoGDPR for environment test', async () => {
    const tcdata = await consentReady(emptyConsentConfig, jsDomWindow, noopLogger, 'test');
    expect(tcdata.gdprApplies).to.be.false;
  });

  it('should return TCDataNoGDPR if enabled=false', async () => {
    const tcdata = await consentReady(
      { ...emptyConsentConfig, enabled: false },
      jsDomWindow,
      noopLogger,
      'production'
    );
    expect(tcdata.gdprApplies).to.be.false;
  });

  ['production' as const, undefined].forEach(env => {
    [tcfapi.status.EventStatus.TC_LOADED, tcfapi.status.EventStatus.USER_ACTION_COMPLETE].forEach(
      eventStatus => {
        [emptyConsentConfig, { ...emptyConsentConfig, enabled: true }].forEach(config => {
          it(`should return TCDataNoGDPR for environment ${env}, event ${eventStatus}, consent.enabled=${config.enabled}`, async () => {
            const tcdataExpected: tcfapi.responses.TCData = {
              ...fullConsent(),
              eventStatus
            };
            tcfapiFn.onFirstCall().callsFake((cmd, version, callback) => {
              expect(cmd).to.be.equals('addEventListener');
              expect(version).to.be.equals(2);
              callback(tcdataExpected, true);
            });

            const tcdata = await consentReady(config, jsDomWindow, noopLogger, env);
            expect(tcdata.gdprApplies).to.be.true;
            expect(tcdataExpected).to.be.equals(tcdataExpected);
          });
        });
      }
    );
  });

  it('should reject if __tcfapi is not defined', () => {
    jsDomWindow.__tcfapi = undefined;
    return expect(
      consentReady(emptyConsentConfig, jsDomWindow, noopLogger, 'production')
    ).to.be.rejectedWith(
      'window.__tcfapi is not defined. Make sure that the stub code is inlined in the head tag'
    );
  });

  it('should reject if cmpStatus is error', async () => {
    const tcdata: tcfapi.responses.TCData = {
      ...fullConsent(),
      cmpStatus: tcfapi.status.CmpStatus.ERROR
    };
    tcfapiFn.onFirstCall().callsFake((cmd, version, callback) => {
      expect(cmd).to.be.equals('addEventListener');
      expect(version).to.be.equals(2);
      callback(tcdata, true);
    });

    await expect(consentReady(emptyConsentConfig, jsDomWindow, noopLogger, 'production')).to.be
      .rejected;
  });

  describe('disallow legitimate interest', () => {
    const consentConfig: Moli.consent.ConsentConfig = {
      disableLegitimateInterest: true
    };

    describe('purpose 1', () => {
      const tcDataWithMissingConsent: tcfapi.responses.TCData = fullConsent();
      tcDataWithMissingConsent.purpose.consents[TCPurpose.STORE_INFORMATION_ON_DEVICE] = false;
      tcDataWithMissingConsent.purpose.legitimateInterests[TCPurpose.STORE_INFORMATION_ON_DEVICE] =
        false;
      it('should return always false for purpose 1 (STORE_INFORMATION_ON_DEVICE)', () => {
        expect(missingPurposeConsent(tcDataWithMissingConsent)).to.be.false;
      });

      it('should reject consentReady if consent is missing for purpose 1 (STORE_INFORMATION_ON_DEVICE)', () => {
        expect(missingPurposeConsent(tcDataWithMissingConsent)).to.be.false;
      });
    });

    [
      TCPurpose.SELECT_BASIC_ADS,
      TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
      TCPurpose.SELECT_PERSONALISED_ADS,
      TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
      TCPurpose.SELECT_PERSONALISED_CONTENT,
      TCPurpose.MEASURE_AD_PERFORMANCE,
      TCPurpose.MEASURE_CONTENT_PERFORMANCE,
      TCPurpose.APPLY_MARKET_RESEARCH,
      TCPurpose.DEVELOP_IMPROVE_PRODUCTS
    ].forEach(purpose => {
      const tcDataWithMissingConsent: tcfapi.responses.TCData = fullConsent();
      tcDataWithMissingConsent.purpose.consents[purpose] = false;
      tcDataWithMissingConsent.purpose.legitimateInterests[purpose] = true;

      it(`should return true if consent is missing for purpose ${purpose} (${TCPurpose[purpose]}), but available as legitimate interest`, () => {
        expect(missingPurposeConsent(tcDataWithMissingConsent)).to.be.true;
      });

      it(`should reject consentReady if consent is missing for purpose ${purpose} (${TCPurpose[purpose]}), but available as legitimate interest`, async () => {
        tcfapiFn.onFirstCall().callsFake((cmd, version, callback) => {
          expect(cmd).to.be.equals('addEventListener');
          expect(version).to.be.equals(2);
          callback(tcDataWithMissingConsent, true);
        });

        await expect(
          consentReady(consentConfig, jsDomWindow, noopLogger, 'production')
        ).to.be.rejectedWith('user consent is missing for some purposes');
      });
    });
  });
});
