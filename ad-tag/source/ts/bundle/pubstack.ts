import type { MoliRuntime } from '../types/moliRuntime';
import { Pubstack } from '../ads/modules/pubstack'; // rollup seems to require pubstack/index to properly resolve the module

declare const window: MoliRuntime.MoliWindow;

window.moli = window.moli || { que: [] };
window.moli.que.push(moli => moli.registerModule(new Pubstack()));
