import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { selectInfiniteSlot } from './selectInfiniteSlot';
import { AdSlot, behaviour } from 'ad-tag/types/moliConfig';
import SlotLoading = behaviour.SlotLoading;

// setup sinon-chai
use(sinonChai);

describe('select infinite slots', () => {
  const sandbox = Sinon.createSandbox();

  const target: Element = { getAttribute: () => null } as any;
  const getAttributeStub = sandbox.stub(target, 'getAttribute');

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  const createSlot = (domId: string, loaded: SlotLoading['loaded']): AdSlot =>
    ({
      domId,
      behaviour: { loaded }
    }) as AdSlot;

  it('should return no ad slot if slots are empty', () => {
    const { configuredInfiniteSlots } = selectInfiniteSlot([]);
    expect(configuredInfiniteSlots).to.be.empty;
  });

  it('should return no ad slot if slots contain no infinite slots', () => {
    const { configuredInfiniteSlots } = selectInfiniteSlot([
      createSlot('slot1', 'eager'),
      createSlot('slot1', 'manual')
    ]);
    expect(configuredInfiniteSlots).to.be.empty;
  });

  it('should return the single slot if configured', () => {
    const slot = createSlot('slot1', 'infinite');
    const { configuredInfiniteSlots, findSlot } = selectInfiniteSlot([slot]);

    getAttributeStub.returns(null);

    expect(configuredInfiniteSlots).to.have.length(1);
    expect(configuredInfiniteSlots).to.contain.all.members([slot]);

    const { configuredInfiniteSlot, configSlotDomId } = findSlot(target);
    expect(configuredInfiniteSlot).to.equal(slot);
    expect(configSlotDomId).to.be.null;
    expect(getAttributeStub).to.have.been.calledOnceWithExactly('data-h5-slot-dom-id');
  });

  it('should return the single slot if configured with domID if present', () => {
    const slot = createSlot('slot1', 'infinite');
    const { configuredInfiniteSlots, findSlot } = selectInfiniteSlot([slot]);

    getAttributeStub.returns('slot1');

    expect(configuredInfiniteSlots).to.have.length(1);
    expect(configuredInfiniteSlots).to.contain.all.members([slot]);

    const { configuredInfiniteSlot, configSlotDomId } = findSlot(target);
    expect(configuredInfiniteSlot).to.equal(slot);
    expect(configSlotDomId).to.eq(slot.domId);
    expect(getAttributeStub).to.have.been.calledOnceWithExactly('data-h5-slot-dom-id');
  });

  it('should return the slot with matching dom id', () => {
    const slot1 = createSlot('slot1', 'infinite');
    const slot2 = createSlot('slot2', 'infinite');
    const slot3 = createSlot('slot3', 'infinite');
    const { configuredInfiniteSlots, findSlot } = selectInfiniteSlot([slot1, slot2, slot3]);

    getAttributeStub.returns('slot2');

    expect(configuredInfiniteSlots).to.have.length(3);
    expect(configuredInfiniteSlots).to.contain.all.members([slot1, slot2, slot3]);

    const { configuredInfiniteSlot, configSlotDomId } = findSlot(target);
    expect(configuredInfiniteSlot).to.equal(slot2);
    expect(configSlotDomId).to.eq(slot2.domId);
    expect(getAttributeStub).to.have.been.calledOnceWithExactly('data-h5-slot-dom-id');
  });
});
