import { ConfigureStep, InitStep, PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';

// if we forget to remove prebid from the configuration. The timeout is arbitrary
const prebidTimeout = (window: Window) => new Promise<void>((_, reject) => {
  window.setTimeout(
    () => reject('Prebid did not resolve in time. Maybe you forgot to import the prebid distribution in the ad tag'),
    5000
  );
});

const prebidInitAndReady = (window: Window) => new Promise<void>(resolve => {
  window.pbjs = window.pbjs || { que: [] };
  window.pbjs.que.push(resolve);
});


export const prebidInit = (window: Window): InitStep => () => Promise.race([ prebidInitAndReady(window), prebidTimeout(window) ]);

export const prebidConfigure = (window: Window, prebidConfig: Moli.headerbidding.PrebidConfig): ConfigureStep =>
  (slots: Moli.AdSlot[]) => new Promise<void>(resolve => {
    resolve();
  });

export const prebidPrepareRequestAds = (window: Window, prebidConfig: Moli.headerbidding.PrebidConfig): PrepareRequestAdsStep =>
  (slots: Moli.SlotDefinition<any>[]) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
    // TODO make sure that we don't call addUnits for a slot more than once
    resolve();
  });

/**
 * If a slot is being refreshed or reloaded.
 * @param window
 */
export const prebidRemoveHbKeyValues = (window: Window): PrepareRequestAdsStep => (slots) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
  resolve(slots);
});
