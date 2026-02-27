import type { MoliRuntime } from '../types/moliRuntime';
import { createZeotap } from 'ad-tag/ads/modules/zeotap';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createZeotap());
