import type { MoliRuntime } from '../types/moliRuntime';
import { YieldOptimization } from 'ad-tag/ads/modules/yield-optimization';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new YieldOptimization());
