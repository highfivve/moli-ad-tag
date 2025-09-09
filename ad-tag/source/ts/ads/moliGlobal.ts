import { MoliRuntime } from '../types/moliRuntime';
import { createMoliTag } from './moli';

// =============================
// ====== Initialization =======
// =============================

/**
 * Initialize the ad tag, the global variable and process any elements in the command que.
 *
 * Only export the public API and hide properties and methods in the DFP Service
 *
 * @param window object
 * @return moli ad tag
 */
export const initAdTag = (window: Window): MoliRuntime.MoliTag => {
  const moliWindow = window as MoliRuntime.MoliWindow;
  const queueCommands = moliWindow.moli
    ? [...(moliWindow.moli.que as MoliRuntime.MoliCommand[])] || []
    : [];

  const moli: MoliRuntime.MoliTag = createMoliTag(window);
  moliWindow.moli = moli;

  queueCommands.forEach(cmd => cmd(moli));

  return moli;
};
