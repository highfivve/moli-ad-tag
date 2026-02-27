import type { MoliRuntime } from '../types/moliRuntime';
import { createAdexModule } from '../ads/modules/adex';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createAdexModule());
