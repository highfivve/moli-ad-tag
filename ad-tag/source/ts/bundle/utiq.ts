import type { MoliRuntime } from '../types/moliRuntime';
import { Utiq } from 'ad-tag/ads/modules/utiq';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Utiq());
