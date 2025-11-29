import type { MoliRuntime } from '../types/moliRuntime';
import { customModule } from 'ad-tag/ads/modules/custom';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(customModule());
