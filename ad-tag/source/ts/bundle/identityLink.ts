import type { MoliRuntime } from '../types/moliRuntime';
import { createIdentityLink } from 'ad-tag/ads/modules/identitylink';

declare const window: MoliRuntime.MoliWindow;
window.moli.registerModule(createIdentityLink());
