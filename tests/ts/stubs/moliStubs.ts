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
  },
  cmpConfig: {
    provider: 'publisher'
  }
};

export const cmpConfig: Moli.consent.ConsentConfig = {
  personalizedAds: {
    provider: 'static',
    value: 0
  },
  cmpConfig: {
    provider: 'faktor',
    autoOptIn: true,
    timeout: 1
  }
};

export const emptyConfig: Moli.MoliConfig = { slots: [], consent: consentConfig, logger: noopLogger };
