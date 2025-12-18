import type { MoliRuntime } from '../types/moliRuntime';
import { MoliAnalytics } from 'ad-tag/ads/modules/moli-analytics';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(MoliAnalytics());
