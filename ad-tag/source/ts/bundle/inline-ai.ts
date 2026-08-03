import type { MoliRuntime } from '../types/moliRuntime';
import { createInlineAi } from '../ads/modules/inline-ai';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createInlineAi());
