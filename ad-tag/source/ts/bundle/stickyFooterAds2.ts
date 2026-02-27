import type { MoliRuntime } from '../types/moliRuntime';
import { createStickyFooterAdsV2 } from 'ad-tag/ads/modules/sticky-footer-ad-v2';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createStickyFooterAdsV2());
