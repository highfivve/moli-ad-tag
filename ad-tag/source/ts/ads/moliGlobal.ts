import { Moli } from '../types/moli';
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
export const initAdTag = (window: Window): Moli.MoliTag => {
  const queueCommands = window.moli ? [...window.moli.que as Moli.MoliCommand[]] || [] : [];

  const moli: Moli.MoliTag = createMoliTag(window);
  window.moli = moli;

  queueCommands.forEach(cmd => cmd(moli));

  return moli;
};

