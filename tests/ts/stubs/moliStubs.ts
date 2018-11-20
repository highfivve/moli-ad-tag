import { Moli } from '../../../source/ts';

export const noopLogger: Moli.MoliLogger = {
  debug: () => { return; },
  info: () => { return; },
  warn: () => { return; },
  error: () => { return; }
};

export const consentConfig: Moli.consent.ConsentConfig = {
  personalizedAds: {
    provider: 'static',
    value: 0
  }
};
