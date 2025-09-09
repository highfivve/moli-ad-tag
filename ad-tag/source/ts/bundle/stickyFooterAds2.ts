import type { MoliRuntime } from '../types/moliRuntime';
import { StickyFooterAdsV2 } from 'ad-tag/ads/modules/sticky-footer-ad-v2';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new StickyFooterAdsV2());
