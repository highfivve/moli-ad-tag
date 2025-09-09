import type { MoliRuntime } from '../types/moliRuntime';
import { StickyHeaderAd } from 'ad-tag/ads/modules/sticky-header-ad';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new StickyHeaderAd());
