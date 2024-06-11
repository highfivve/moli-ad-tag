import type { MoliRuntime } from '../types/moliRuntime';

declare const window: MoliRuntime.MoliWindow;

// TODO probably this can be refactored into a single bundle file as well
window.moli = window.moli || { que: [] };
window.moli.que.push(moli => moli.requestAds());
