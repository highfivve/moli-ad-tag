import { Moli } from '../types/moli';
import { AdSlot, MoliConfig } from '../types/moliConfig';

export const newNoopLogger = (withErrorLogs?: boolean): Moli.MoliLogger => {
  return {
    debug: () => {
      return;
    },
    info: () => {
      return;
    },
    warn: () => {
      return;
    },
    error: (message?: any, ...optionalParams: any[]) => {
      if (withErrorLogs) {
        console.error(message, ...optionalParams);
      }
    }
  };
};

export const noopLogger: Moli.MoliLogger = newNoopLogger();

export const newEmptyConfig = (slots: AdSlot[] = []): MoliConfig => {
  return {
    slots: slots,
    schain: {
      supplyChainStartNode: {
        asi: 'highfivve.com',
        sid: '1000',
        hp: 1
      }
    }
  };
};

export const emptyConfig: MoliConfig = newEmptyConfig();
