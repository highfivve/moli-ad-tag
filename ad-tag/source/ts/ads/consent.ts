import { Moli } from '../types/moli';
import { tcfapi } from '../types/tcfapi';

export const consentReady = (window: Window & tcfapi.TCFApiWindow, log: Moli.MoliLogger) => {
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
