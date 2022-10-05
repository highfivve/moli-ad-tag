import { getLogger } from './logging';

export const addNewInfiniteSlotToConfig = (config, idOfConfiguredSlot, artificialIdOfNewSlot) => {
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
