import type { MoliRuntime } from '../types/moliRuntime';
import { createCleanup } from '../ads/modules/cleanup';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createCleanup());
