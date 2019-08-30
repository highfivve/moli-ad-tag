import { Moli } from '../../../source/ts';

export const newNoopLogger = (): Moli.MoliLogger => {
  return {
    debug: () => { return; },
    info: () => { return; },
    warn: () => { return; },
    error: () => { return; }
  };
};

export const noopLogger: Moli.MoliLogger = newNoopLogger();

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
