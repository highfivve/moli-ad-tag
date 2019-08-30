import { Moli } from '../types/moli';
import { createMoliTag } from './moli';



// =============================
// ====== Initialization =======
// =============================

const queueCommands = window.moli ? [...window.moli.que as Moli.MoliCommand[]] || [] : [];

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = createMoliTag(window);
window.moli = moli;

queueCommands.forEach(cmd => cmd(moli));
