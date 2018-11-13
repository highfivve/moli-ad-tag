import { Moli } from '../../../source/ts';

export const noopLogger: Moli.MoliLogger = {
  debug: () => { return; },
  info: () => { return; },
  warn: () => { return; },
  error: () => { return; }
};
