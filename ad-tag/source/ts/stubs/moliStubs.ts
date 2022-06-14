import { Moli } from '../types/moli';

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

export const newEmptyConfig = (slots: Moli.AdSlot[] = []): Moli.MoliConfig => {
  return {
    slots: slots,
    logger: newNoopLogger(),
    schain: {
      supplyChainStartNode: {
        asi: 'highfivve.com',
        sid: '1000',
        hp: 1
      }
    }
  };
};

export const emptyConfig: Moli.MoliConfig = newEmptyConfig();
