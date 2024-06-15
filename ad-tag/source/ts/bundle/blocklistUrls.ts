import type { MoliRuntime } from '../types/moliRuntime';
import { BlocklistedUrls } from '../ads/modules/blocklist-url';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new BlocklistedUrls());
