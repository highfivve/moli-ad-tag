import type { MoliRuntime } from '../types/moliRuntime';
import { StickyFooterAd } from 'ad-tag/ads/modules/sticky-footer-ad';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new StickyFooterAd());
