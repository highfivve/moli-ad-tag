import type { MoliRuntime } from '../types/moliRuntime';
import { Skin } from '../ads/modules/generic-skin';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Skin());
