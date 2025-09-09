import type { MoliRuntime } from '../types/moliRuntime';
import { Pubstack } from '../ads/modules/pubstack';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Pubstack());
