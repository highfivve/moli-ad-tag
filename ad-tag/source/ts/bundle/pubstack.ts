import type { MoliRuntime } from '../types/moliRuntime';
import { createPubstack } from '../ads/modules/pubstack';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createPubstack());
