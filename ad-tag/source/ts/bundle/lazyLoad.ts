import type { MoliRuntime } from '../types/moliRuntime';
import { LazyLoad } from 'ad-tag/ads/modules/lazy-load';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new LazyLoad());
