import type { MoliRuntime } from '../types/moliRuntime';
import { Zeotap } from 'ad-tag/ads/modules/zeotap';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Zeotap());
