import type { MoliRuntime } from '../types/moliRuntime';
import { createConfiant } from '../ads/modules/confiant';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createConfiant());
