import { Moli } from '../types/moli';
import { tcfapi } from '../types/tcfapi';
import EventStatus = tcfapi.status.EventStatus;
import CmpStatus = tcfapi.status.CmpStatus;

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
 * @param window access `__tcfapi` API
 * @param log logging output
 * @param env test environment requires no CMP
 */
export const consentReady = (
  window: Window & tcfapi.TCFApiWindow,
  log: Moli.MoliLogger,
  env: Moli.Environment | undefined
): Promise<tcfapi.responses.TCData> => {
  if (env === 'test') {
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
          resolve(tcData);
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
