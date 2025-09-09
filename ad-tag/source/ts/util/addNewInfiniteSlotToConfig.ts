import { getLogger } from './logging';
import { MoliConfig } from '../types/moliConfig';
import { MoliRuntime } from '../types/moliRuntime';

/**
 * Add a slot with a new domId and the configuration of the 'infinite' loading ad slot to the moli config
 *
 * TODO rethink this and if we can get around altering the config.slots property and create a mapping some other way
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
    const newAdSlot = { ...configuredInfiniteAdSlot, domId: artificialIdOfNewSlot };
    return { ...config, slots: [...config.slots, newAdSlot] };
  } else {
    logger.error('MoliGlobal', `no infinite ad slot configured!`, config);
    return config;
  }
};
