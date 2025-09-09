import type { MoliRuntime } from '../types/moliRuntime';
import { AdReload } from '../ads/modules/ad-reload';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new AdReload());
