import type { MoliRuntime } from '../types/moliRuntime';
import { createStickyHeaderAd } from 'ad-tag/ads/modules/sticky-header-ad';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createStickyHeaderAd());
