import type { MoliRuntime } from '../types/moliRuntime';
import { Confiant } from '../ads/modules/confiant';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Confiant());
