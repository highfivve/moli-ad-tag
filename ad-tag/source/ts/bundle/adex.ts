import type { MoliRuntime } from '../types/moliRuntime';
import { AdexModule } from '../ads/modules/adex';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new AdexModule());
