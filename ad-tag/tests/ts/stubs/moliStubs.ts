import { Moli } from '../../../source/ts/types/moli';

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
    yieldOptimization: { provider: 'none' }
  };
};

export const emptyConfig: Moli.MoliConfig = newEmptyConfig();
