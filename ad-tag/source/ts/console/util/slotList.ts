/**
 * Which slots are shown in the ad setup slot list.
 */
export type SlotFilter = 'all' | 'rendered';

/**
 * How the slots in the ad setup slot list are ordered.
 *
 * - `rendered` - rendered slots first, each group alphabetically
 * - `alphabetical` - alphabetically by dom id
 */
export type SlotSort = 'rendered' | 'alphabetical';

/**
 * Filters and sorts the slots for the ad setup slot list. The input is not mutated.
 */
export const filterAndSortSlots = <S extends { readonly domId: string }>(
  slots: ReadonlyArray<S>,
  filter: SlotFilter,
  sort: SlotSort,
  isRendered: (slot: S) => boolean
): S[] => {
  const filtered = filter === 'rendered' ? slots.filter(isRendered) : [...slots];
  return filtered.sort((a, b) => {
    if (sort === 'rendered') {
      const renderedOrder = Number(isRendered(b)) - Number(isRendered(a));
      if (renderedOrder !== 0) {
        return renderedOrder;
      }
    }
    return a.domId.localeCompare(b.domId);
  });
};
