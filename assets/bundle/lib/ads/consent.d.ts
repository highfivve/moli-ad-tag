import { MoliRuntime } from '../types/moliRuntime';
import { tcfapi } from '../types/tcfapi';
import { consent, Environment } from '../types/moliConfig';
export declare const missingPurposeConsent: (tcData: tcfapi.responses.TCData) => boolean;
export declare const consentReady: (consentConfig: consent.ConsentConfig, window: Window & tcfapi.TCFApiWindow, log: MoliRuntime.MoliLogger, env: Environment | undefined) => Promise<tcfapi.responses.TCData>;
