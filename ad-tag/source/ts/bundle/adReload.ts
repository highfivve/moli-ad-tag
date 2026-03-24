import type { MoliRuntime } from '../types/moliRuntime';
import { createAdReload } from '../ads/modules/ad-reload';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createAdReload());
