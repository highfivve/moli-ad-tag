import { Moli } from '../types/moli';
import { tcfapi } from '../types/tcfapi';
import EventStatus = tcfapi.status.EventStatus;
import CmpStatus = tcfapi.status.CmpStatus;
import { consent } from '../types/moliConfig';

const allPurposes: tcfapi.responses.TCPurpose[] = [
  tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE,
  tcfapi.responses.TCPurpose.SELECT_BASIC_ADS,
  tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
  tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS,
  tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
  tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT,
  tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE,
  tcfapi.responses.TCPurpose.MEASURE_CONTENT_PERFORMANCE,
  tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH,
  tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS
];

/**
 * This method returns false as soon as there's at least one purpose where
 * legitimate interest is available, but consent is not.
 *
 * @param tcData
 */
export const missingPurposeConsent = (tcData: tcfapi.responses.TCData): boolean => {
  return (
    // gdpr must apply
    !!tcData.gdprApplies &&
    // for all purposes
    allPurposes.some(p => !tcData.purpose.consents[p] && tcData.purpose.legitimateInterests[p])
  );
};

/**
 * Returns a promise with the received consent. There are two ways this can happen
 *
 * 1. User has already given consent - Promise returns once `tcloaded` event
 *    has fired and returns the `TCData` response
 * 2. User has not seen the 1. layer yet - Promise returns once `useractioncomplete`
 *    event has fired and returns the `TCData` response
 *
 * The Promise is rejected if the `__tcfapi` is not present or the `cmpStatus`
 * is `error`.
 *
 * @param consentConfig - customize consentReady
 * @param window access `__tcfapi` API
 * @param log logging output
 * @param env test environment requires no CMP
 */
export const consentReady = (
  consentConfig: consent.ConsentConfig,
  window: Window & tcfapi.TCFApiWindow,
  log: Moli.MoliLogger,
  env: Moli.Environment | undefined
): Promise<tcfapi.responses.TCData> => {
  if (env === 'test') {
    log.info('gdprApplies is set to false in test mode!');
  }
  if (env === 'test' || consentConfig.enabled === false) {
    return Promise.resolve({
      gdprApplies: false,
      eventStatus: EventStatus.TC_LOADED,
      cmpStatus: CmpStatus.LOADED,
      cmpId: 0,
      cmpVersion: 0,
      tcfPolicyVersion: undefined,
      listenerId: null
    });
  }
  return new Promise<tcfapi.responses.TCData>((resolve, reject) => {
    if (window.__tcfapi) {
      const listener = (tcData: tcfapi.responses.TCData) => {
        if (tcData.cmpStatus === 'error') {
          reject(tcData);
        } else if (
          tcData.eventStatus === 'useractioncomplete' ||
          tcData.eventStatus === 'tcloaded'
        ) {
          log.debug('Consent', 'consent ready', tcData);

          if (consentConfig.disableLegitimateInterest && missingPurposeConsent(tcData)) {
            reject('user consent is missing for some purposes');
          } else {
            resolve(tcData);
          }

          if (tcData.listenerId) {
            window.__tcfapi!(
              'removeEventListener',
              2,
              () => {
                return;
              },
              tcData.listenerId
            );
          }
        }
      };
      window.__tcfapi('addEventListener', 2, listener);
    } else {
      reject(
        'window.__tcfapi is not defined. Make sure that the stub code is inlined in the head tag'
      );
    }
  });
};
