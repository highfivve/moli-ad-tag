import { Moli } from '@highfivve/ad-tag';

type FindSlotResult = {
  configuredInfiniteSlot: Moli.AdSlot | undefined;
  configSlotDomId: string | null;
};

/**
 * Returns the list of available infinite slots and a method to select the proper slot based on the target element
 * that is observed.
 * @param slots
 */
export const selectInfiniteSlot: (slots: Moli.AdSlot[]) => {
  /**
   * List of configured infinite slots
   */
  configuredInfiniteSlots: Moli.AdSlot[];
  /**
   * Method to find the proper infinite slot based on the target element. Looks for data-h5-slot-dom-id attribute
   * @param target - The target element that is observed via an IntersectionObserver
   */
  findSlot: (target: Element) => FindSlotResult;
} = (slots: Moli.AdSlot[]) => {
  const configuredInfiniteSlots = slots.filter(slot => slot.behaviour.loaded === 'infinite');

  const findSlot = (target: Element) => {
    const configSlotDomId = target.getAttribute('data-h5-slot-dom-id');

    // fallback to the first slot if no slot dom id is found. Which is the current behaviour and what works for most
    // publishers anyway, because the only have a single infinite slot.
    const configuredInfiniteSlot = configSlotDomId
      ? configuredInfiniteSlots.find(slot => slot.domId === configSlotDomId)
      : configuredInfiniteSlots[0];
    return { configuredInfiniteSlot, configSlotDomId };
  };
  return { configuredInfiniteSlots, findSlot };
};
