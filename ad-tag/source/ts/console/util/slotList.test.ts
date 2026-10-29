import { expect } from 'chai';

import { filterAndSortSlots } from './slotList';

describe('filterAndSortSlots', () => {
  const slots = [
    { domId: 'c-rendered' },
    { domId: 'b-hidden' },
    { domId: 'a-hidden' },
    { domId: 'd-rendered' }
  ];
  const isRendered = (slot: { domId: string }): boolean => slot.domId.endsWith('-rendered');
  const domIds = (result: { domId: string }[]): string[] => result.map(slot => slot.domId);

  it('should return all slots alphabetically', () => {
    const result = filterAndSortSlots(slots, 'all', 'alphabetical', isRendered);
    expect(domIds(result)).to.deep.equal(['a-hidden', 'b-hidden', 'c-rendered', 'd-rendered']);
  });

  it('should return rendered slots first, each group alphabetically', () => {
    const result = filterAndSortSlots(slots, 'all', 'rendered', isRendered);
    expect(domIds(result)).to.deep.equal(['c-rendered', 'd-rendered', 'a-hidden', 'b-hidden']);
  });

  it('should return only rendered slots', () => {
    const result = filterAndSortSlots(slots, 'rendered', 'alphabetical', isRendered);
    expect(domIds(result)).to.deep.equal(['c-rendered', 'd-rendered']);
  });

  it('should not mutate the input', () => {
    filterAndSortSlots(slots, 'all', 'alphabetical', isRendered);
    expect(domIds(slots)).to.deep.equal(['c-rendered', 'b-hidden', 'a-hidden', 'd-rendered']);
  });
});
