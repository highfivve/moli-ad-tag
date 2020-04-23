import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from './adPipeline';
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


export const prebidInit = (window: Window): InitStep => (context) => Promise.race([ prebidInitAndReady(context.window), prebidTimeout(context.window) ]);

export const prebidConfigure = (prebidConfig: Moli.headerbidding.PrebidConfig): ConfigureStep =>
  (context: AdPipelineContext, slots: Moli.AdSlot[]) => new Promise<void>(resolve => {
    resolve();
  });

export const prebidPrepareRequestAds = (prebidConfig: Moli.headerbidding.PrebidConfig): PrepareRequestAdsStep =>
  (context: AdPipelineContext, slots: Moli.SlotDefinition<any>[]) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
    // TODO make sure that we don't call addUnits for a slot more than once
    resolve();
  });

/**
 * If a slot is being refreshed or reloaded.
 * @param window
 */
export const prebidRemoveHbKeyValues = (): PrepareRequestAdsStep => (context: AdPipelineContext, slots) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
  resolve(slots);
});
