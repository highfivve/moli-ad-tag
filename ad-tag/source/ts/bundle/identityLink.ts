import type { MoliRuntime } from '../types/moliRuntime';
import { IdentityLink } from 'ad-tag/ads/modules/identitylink';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(new IdentityLink());
