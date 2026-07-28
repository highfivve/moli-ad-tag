import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { expect } from 'chai';
import * as Sinon from 'sinon';
import { findGoogletagSlot } from 'ad-tag/ads/findGoogletagSlot';
import { googletag } from 'ad-tag/types/googletag';

describe('findGoogletagSlot', () => {
  const sandbox = Sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  const stubSlots = (slots: googletag.IAdSlot[]) => {
    const gpt = createGoogletagStub();
    sandbox.stub(gpt.pubads(), 'getSlots').returns(slots);
    return gpt;
  };

  it('finds a slot by domId', () => {
    const slot = googleAdSlotStub('/123/ad-unit', 'dom-id-1');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ domId: 'dom-id-1' }, gpt);
    expect(result).to.equal(slot);
  });

  it('finds a slot by adUnitPath', () => {
    const slot = googleAdSlotStub('/123/ad-unit', 'dom-id-1');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ adUnitPath: '/123/ad-unit' }, gpt);
    expect(result).to.equal(slot);
  });

  it('returns undefined if no slot matches', () => {
    const slot = googleAdSlotStub('/123/ad-unit', 'dom-id-1');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ domId: 'other-id', adUnitPath: '/other/path' }, gpt);
    expect(result).to.be.undefined;
  });

  it('returns undefined when reference.domId is undefined, even if a slot has no domId', () => {
    const slot = googleAdSlotStub('/123/ad-unit', undefined as unknown as string);
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ domId: undefined, adUnitPath: '/no/match' }, gpt);
    expect(result).to.be.undefined;
  });

  it('returns undefined when reference.adUnitPath is undefined, even if a slot has no adUnitPath', () => {
    const slot = googleAdSlotStub(undefined as unknown as string, 'dom-id-1');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ domId: 'no-match', adUnitPath: undefined }, gpt);
    expect(result).to.be.undefined;
  });

  it('returns undefined when reference has neither domId nor adUnitPath', () => {
    const slot = googleAdSlotStub('/123/ad-unit', 'dom-id-1');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({}, gpt);
    expect(result).to.be.undefined;
  });

  it('does not match empty string domId/adUnitPath from either side', () => {
    const slot = googleAdSlotStub('', '');
    const gpt = stubSlots([slot]);

    const result = findGoogletagSlot({ domId: '', adUnitPath: '' }, gpt);
    expect(result).to.be.undefined;
  });
});
