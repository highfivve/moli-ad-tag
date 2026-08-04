import { getLogger } from './logging';
import { AdSlot, MoliConfig } from '../types/moliConfig';
import { MoliRuntime } from '../types/moliRuntime';

/**
 * Create the ad slot that a `refreshInfiniteAdSlot` call refers to.
 *
 * An infinite ad slot is never configured on its own. The publisher configures a single slot with an
 * `infinite` loading behaviour that acts as a template, and every call names that template plus the
 * artificial domId of the element that should be filled. The resulting slot is the template with the
 * artificial domId.
 *
 * @param configuredSlot the configured ad slot with an 'infinite' loading behaviour
 * @param artificialDomId the artificial domId of the new infinite ad slot
 */
export const mkInfiniteSlot = (configuredSlot: AdSlot, artificialDomId: string): AdSlot => ({
  ...configuredSlot,
  domId: artificialDomId
});

/**
 * Add a slot with a new domId and the configuration of the 'infinite' loading ad slot to the moli config
 *
 * TODO rethink this and if we can get around altering the config.slots property and create a mapping some other way
 *   `adService.requestAds` no longer needs this - it derives the infinite slots from
 *   `runtimeConfig.refreshInfiniteSlots` via `mkInfiniteSlot`. Only `adService.refreshAdSlots` still
 *   resolves slots by looking up `config.slots`, so that path is what keeps this function alive.
 *
 * @param config the moli config
 * @param idOfConfiguredSlot the domId of the configured ad slot with an 'infinite' loading behaviour
 * @param artificialIdOfNewSlot the artificial domId for the added newly added infinite slot
 * @param logger
 */
export const addNewInfiniteSlotToConfig = (
  config: MoliConfig,
  idOfConfiguredSlot: string,
  artificialIdOfNewSlot: string,
  logger: MoliRuntime.MoliLogger
): MoliConfig => {
  const configuredInfiniteAdSlot = config.slots.find(
    configSlot => configSlot.domId === idOfConfiguredSlot
  );
  if (configuredInfiniteAdSlot) {
    const newAdSlot = mkInfiniteSlot(configuredInfiniteAdSlot, artificialIdOfNewSlot);
    return { ...config, slots: [...config.slots, newAdSlot] };
  } else {
    logger.error('MoliGlobal', `no infinite ad slot configured!`, config);
    return config;
  }
};
