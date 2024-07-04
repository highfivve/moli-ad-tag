import type { MoliRuntime } from '../types/moliRuntime';
import { PrebidFirstPartyDataModule } from 'ad-tag/ads/modules/prebid-first-party-data';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new PrebidFirstPartyDataModule());
