import type { MoliRuntime } from '../types/moliRuntime';
import { createIntentIq } from 'ad-tag/ads/modules/intentiq';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createIntentIq());
