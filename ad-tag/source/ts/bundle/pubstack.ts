import type { MoliRuntime } from '../types/moliRuntime';
import { Pubstack } from '../ads/modules/pubstack';

declare const window: MoliRuntime.MoliWindow;

window.moli = window.moli || { que: [] };
window.moli.que.push(moli => moli.registerModule(new Pubstack()));
