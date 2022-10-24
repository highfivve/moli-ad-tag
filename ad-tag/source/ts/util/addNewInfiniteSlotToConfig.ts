import { getLogger } from './logging';
import { Moli } from '../types/moli';

/**
 * Add a slot with a new domId and the configuration of the 'infinite' loading ad slot to the moli config
 * @param config the moli config
 * @param idOfConfiguredSlot the domId of the configured ad slot with an 'infinite' loading behaviour
 * @param artificialIdOfNewSlot the artificial domId for the added newly added infinite slot
 * @param window
 */

export const addNewInfiniteSlotToConfig = (
  config: Moli.MoliConfig,
  idOfConfiguredSlot: string,
  artificialIdOfNewSlot: string,
  window: Window
): Moli.MoliConfig => {
  let newConfig = config;

  const configuredInfiniteAdSlot = config.slots.find(
    configSlot => configSlot.domId === idOfConfiguredSlot
  );
  if (configuredInfiniteAdSlot) {
    const newAdSlot = { ...configuredInfiniteAdSlot, domId: artificialIdOfNewSlot };
    newConfig = { ...config, slots: [...config.slots, newAdSlot] };
  } else {
    getLogger(config, window).error('MoliGlobal', `no infinite ad slot configured!`, config);
  }

  return newConfig;
};
