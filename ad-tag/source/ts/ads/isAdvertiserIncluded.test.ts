import { expect } from 'chai';
import { isAdvertiserIncluded } from './isAdvertiserIncluded';
import { googletag } from 'ad-tag/types/googletag';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;

describe('isAdvertiserIncluded', () => {
  it('returns true if advertiserId is in the list', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 123, companyIds: [456, 789] } as any;
    expect(isAdvertiserIncluded(event, [123])).to.be.true;
  });

  it('returns true if any companyId is in the list', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 111, companyIds: [456, 789] } as any;
    expect(isAdvertiserIncluded(event, [789])).to.be.true;
  });

  it('returns false if neither advertiserId nor companyIds are in the list', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 111, companyIds: [456, 789] } as any;
    expect(isAdvertiserIncluded(event, [999])).to.be.false;
  });

  it('returns false if advertisersList is empty', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 123, companyIds: [456, 789] } as any;
    expect(isAdvertiserIncluded(event, [])).to.be.false;
  });

  it('returns false if event has no advertiserId or companyIds', () => {
    const event: ISlotRenderEndedEvent = {} as any;
    expect(isAdvertiserIncluded(event, [123, 456])).to.be.false;
  });

  it('returns false if event has undefined companyIds', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 111, companyIds: undefined } as any;
    expect(isAdvertiserIncluded(event, [222])).to.be.false;
  });

  it('returns true if both advertiserId and companyIds are in the list', () => {
    const event: ISlotRenderEndedEvent = { advertiserId: 123, companyIds: [123, 456] } as any;
    expect(isAdvertiserIncluded(event, [123, 456])).to.be.true;
  });
});
