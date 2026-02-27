import type { MoliRuntime } from '../types/moliRuntime';
import { createSkin } from '../ads/modules/generic-skin';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createSkin());
