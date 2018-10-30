import test, {GenericTestContext} from 'ava';
import Sinon = require('sinon');

import {DfpPrebidSlot, DfpQDPPositionSlot, DfpSlotSize} from './adNetworkSlot';
import {googletag} from '../../../types/googletag';


test.beforeEach((t: GenericTestContext<any>) => {
  t.context.googleTag = <googletag.IGoogleTag> {
    cmd: [],
    pubads: () => t.context.googleTag,
    defineSlot: (_adUnitPath: string, _size: number[][], _slotId: string) => <googletag.IAdSlot> {
      setCollapseEmptyDiv(_doCollapse: boolean): void { return; },
      addService(_service: any): void { return; }
    },
    destroySlots: (_opt_slots: googletag.IAdSlot[]) => { return; },
    defineOutOfPageSlot: (_adUnitPath: string, _slotId: string) => <googletag.IAdSlot> {
      setCollapseEmptyDiv(_doCollapse: boolean): void { return; },
      addService(_service: any): void { return; }
    },
    enableServices: () => null,
    display: (_id: String) => null
  };
});

test('QDP Position ad slot provides the correct adUnitPath', (t: GenericTestContext<any>) => {
  let slot = new DfpQDPPositionSlot('a-random-id', 'a-fancy-position', [[20, 20]]);
  t.truthy(slot.adUnitPath === '/33559401/gf/fragen/a-fancy-position');
});

test('QDP Position ad slot defines itself on google tag service', (t: GenericTestContext<any>) => {
  let slot = new DfpQDPPositionSlot('another-id', 'a-not-less-fancy-position', [[42, 42]]);
  let spy = Sinon.spy(t.context.googleTag, 'defineSlot');
  let outOfPageSpy = Sinon.spy(t.context.googleTag, 'defineOutOfPageSlot');

  slot.defineSlotOnGoogleTag(t.context.googleTag);
  t.truthy(spy.calledWith(slot.adUnitPath, slot.size, slot.id));
  t.false(outOfPageSpy.called);
});

test('DfpPrebidSlot has no duplicates in the mediaTypes sizes field', (t: GenericTestContext<any>) => {
  const allSizes: DfpSlotSize[] = [[1, 1], [605, 340], [605, 185], 'fluid'];
  const slot = new DfpPrebidSlot(new DfpQDPPositionSlot('test', 'pos', allSizes),
    [],
    {
      banner: {
        sizes: [[1, 1], [605, 340]]
      },
      video: {
        context: 'outstream',
        playerSize: [605, 340]
      }
    });
  t.deepEqual(slot.size, allSizes);
  t.deepEqual(slot.prebidSizes(), slot.mediaTypes.banner!.sizes);
});

