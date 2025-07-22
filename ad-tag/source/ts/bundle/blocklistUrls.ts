import type { MoliRuntime } from '../types/moliRuntime';
import { createBlocklistedUrls } from '../ads/modules/blocklist-url';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createBlocklistedUrls());
