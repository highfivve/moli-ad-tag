import { Moli } from '../../../source/ts/types/moli';
import { IABConsentManagement } from '../../../source/ts/types/IABConsentManagement';

export const newNoopLogger = (): Moli.MoliLogger => {
  return {
    debug: () => { return; },
    info: () => { return; },
    warn: () => { return; },
    error: (message?: any, ...optionalParams: any[]) => { console.error(message, ...optionalParams); }
  };
};

export const cmpModule = (): Moli.consent.CmpModule => {
  return {
    name: 'mock cmp',
    description: 'mock cmp',
    moduleType: 'cmp',
    config(): Object | null {
      return null;
    },
    init(config: Moli.MoliConfig): void {
      config.consent.cmp = this;
      return;
    },
    getNonPersonalizedAdSetting(): Promise<0 | 1> {
      return Promise.resolve(0);
    },
    getConsentData(): Promise<IABConsentManagement.IConsentData> {
      return Promise.reject();
    },
    getVendorConsents(): Promise<IABConsentManagement.IVendorConsents> {
      return Promise.reject();
    }
  };
};

export const noopLogger: Moli.MoliLogger = newNoopLogger();

export const consentConfig: Moli.consent.ConsentConfig = {
  cmp: cmpModule()
};


export const emptyConfig: Moli.MoliConfig = { slots: [], consent: consentConfig, logger: noopLogger };
