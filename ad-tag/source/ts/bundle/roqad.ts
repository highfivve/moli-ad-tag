import type { MoliRuntime } from '../types/moliRuntime';
import { createRoqad } from '../ads/modules/roqad';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createRoqad());
