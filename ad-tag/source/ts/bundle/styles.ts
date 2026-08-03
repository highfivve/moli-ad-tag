import type { MoliRuntime } from '../types/moliRuntime';
import { createStylesLoader } from '../ads/modules/styles';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createStylesLoader());
