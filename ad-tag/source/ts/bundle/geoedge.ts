import type { MoliRuntime } from '../types/moliRuntime';
import { geoEdge } from '../ads/modules/geoedge';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(geoEdge());
