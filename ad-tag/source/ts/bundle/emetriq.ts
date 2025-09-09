import type { MoliRuntime } from '../types/moliRuntime';
import { Emetriq } from 'ad-tag/ads/modules/emetriq';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new Emetriq());
