import type { MoliRuntime } from '../types/moliRuntime';
import { createEmetriq } from 'ad-tag/ads/modules/emetriq';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createEmetriq());
