import type { MoliRuntime } from '../types/moliRuntime';
import { feedModule } from 'ad-tag/ads/modules/feed';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(feedModule());
