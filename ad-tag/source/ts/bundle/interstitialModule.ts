import type { MoliRuntime } from '../types/moliRuntime';
import { InterstitialModule } from 'ad-tag/ads/modules/interstitial';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new InterstitialModule());
