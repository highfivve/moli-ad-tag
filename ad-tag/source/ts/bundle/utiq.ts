import type { MoliRuntime } from '../types/moliRuntime';
import { createUtiq } from 'ad-tag/ads/modules/utiq';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createUtiq());
