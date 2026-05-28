import type { MoliRuntime } from '../types/moliRuntime';
import { createInterstitialModule } from 'ad-tag/ads/modules/interstitial';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createInterstitialModule());
