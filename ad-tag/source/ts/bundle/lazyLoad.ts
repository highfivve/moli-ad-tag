import type { MoliRuntime } from '../types/moliRuntime';
import { createLazyLoad } from 'ad-tag/ads/modules/lazy-load';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createLazyLoad());
