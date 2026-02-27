import type { MoliRuntime } from '../types/moliRuntime';
import { createPrebidFirstPartyDataModule } from 'ad-tag/ads/modules/prebid-first-party-data';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createPrebidFirstPartyDataModule());
