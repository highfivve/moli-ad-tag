import { getLogger } from './logging';
import { Moli } from '../types/moli';

export const addNewInfiniteSlotToConfig = (
  config: Moli.MoliConfig,
  idOfConfiguredSlot: string,
  artificialIdOfNewSlot: string
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
