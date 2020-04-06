import { ConfigureStep, DefineSlotsStep, InitStep, RequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { SizeConfigService } from './sizeConfigService';
import { googletag } from '../types/googletag';

/**
 * Decides which sizeConfigService to use - if the slot brings its own sizeConfig, it gets precedence over the
 * global one.
 *
 * @param moliSlot the ad slot
 */
const getSizeFilterFunction = (window: Window, moliSlot: Moli.AdSlot): Moli.FilterSupportedSizes => {
  return (givenSizes: Moli.DfpSlotSize[]) => new SizeConfigService(moliSlot.sizeConfig, window).filterSupportedSizes(givenSizes);
};

const configureTargeting = (targeting: Moli.Targeting | undefined, env: Moli.Environment): void => {
  switch (env) {
    case 'production':
      const keyValueMap = targeting ? targeting.keyValues : {};
      Object.keys(keyValueMap).forEach(key => {
        const value = keyValueMap[key];
        if (value) {
          window.googletag.pubads().setTargeting(key, value);
        }
      });
      return;
    case 'test':
      return;
  }
};

export const gptInit = (window: Window): InitStep => () => new Promise<void>(resolve => {
  window.googletag = window.googletag || { cmd: [] };
  window.googletag.cmd.push(resolve);
});

export const gptConfigure = (window: Window, config: Moli.MoliConfig, logger: Moli.MoliLogger): ConfigureStep => (slots: Moli.AdSlot[])  => new Promise<void>(resolve => {
  const env = config.environment || 'production';
  switch (env) {
    case 'production':
      configureTargeting(config.targeting, env);

      window.googletag.pubads().enableAsyncRendering();
      window.googletag.pubads().disableInitialLoad();
      window.googletag.pubads().enableSingleRequest();

      window.googletag.enableServices();
      return Promise.resolve();
    case 'test':
      // Note that this call is actually important to initialize the content service. Otherwise
      // the service won't be enabled with the `googletag.enableServices()`.
      window.googletag.content().getSlots();
      window.googletag.enableServices();
      return Promise.resolve();
  }
});

export const gptDefineSlots = (window: Window, env: Moli.Environment, logger: Moli.MoliLogger): DefineSlotsStep => (slots: Moli.AdSlot[]) => new Promise<SlotDefinition<any>[]>(resolve => {
  const slotDefinitions = slots.map(moliSlot => {
    const filterSupportedSizes = getSizeFilterFunction(window, moliSlot);
    const sizes = filterSupportedSizes(moliSlot.sizes);

    // lookup existing slots and use those if already present. This makes defineSlots idempotent
    const existingSlot = window.googletag.pubads().getSlots().find(s => s.getSlotElementId() === moliSlot.domId);
    const adSlot: googletag.IAdSlot | null = existingSlot ? existingSlot : (moliSlot.position === 'in-page' ?
      window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
      window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId)
    );

    if (adSlot) {
      adSlot.setCollapseEmptyDiv(true);
      switch (env) {
        case 'production':
          adSlot.addService(window.googletag.pubads());
          logger.debug('DFP Service', `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
          // TODO priceRule is handled in another module and should be remove from the slotDefinitions
          return Promise.resolve<SlotDefinition<any>>({ moliSlot, adSlot, filterSupportedSizes, priceRule: undefined });
        case 'test':
          logger.warn('DFP Service', `Enabling content service on ${adSlot.getSlotElementId()}`);
          adSlot.addService(window.googletag.content());
          // TODO priceRule is handled in another module and should be remove from the slotDefinitions
          return Promise.resolve<SlotDefinition<any>>({ moliSlot, adSlot, filterSupportedSizes, priceRule: undefined });
        default:
          return Promise.reject(`invalid environment: ${env}`);
      }
    } else {
      const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
      logger.error('DFP Service', error);
      return Promise.reject(new Error(error));
    }

  });

  return Promise.all(slotDefinitions);
});

export const gptRequestAds = (window: Window): RequestAdsStep => (slots: SlotDefinition<any>[]) => new Promise<void>(resolve => {
  resolve();
});
