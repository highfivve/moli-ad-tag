import type { MoliRuntime } from '../types/moliRuntime';
import { Cleanup } from '../ads/modules/cleanup';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Cleanup());
