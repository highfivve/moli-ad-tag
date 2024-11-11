// setup sinon-chai
import sinonChai from 'sinon-chai';
import { expect, use } from 'chai';
import { createDom } from '../../stubs/browserEnvSetup';
import * as Sinon from 'sinon';
import { AdRequestThrottling } from './adRequestThrottling';
import { googletag } from '../../types/googletag';

use(sinonChai);

describe('ad request throttling', () => {
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');

  const throttle = (throttleInSeconds: number, includedDomIds?: string[]) =>
    new AdRequestThrottling(
      { enabled: true, throttle: throttleInSeconds, includedDomIds },
      jsDomWindow
    );

  const slotRequestedEvent = (slotId: string) =>
    ({ slot: { getSlotElementId: () => slotId } }) as googletag.events.ISlotRequestedEvent;

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  it('should not throttle requests if no events have been fired', () => {
    const adRequestThrottling = throttle(10);
    const slotId = 'slot-1';

    expect(adRequestThrottling.isThrottled(slotId)).to.be.false;
  });

  it('should not throttle requests if events have been fired for another slot', () => {
    const adRequestThrottling = throttle(10);
    adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-1'));
    expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(Sinon.match.func, 10 * 1000);

    expect(adRequestThrottling.isThrottled('slot-2')).to.be.false;
  });

  it('should throttle requests if events have been fired for a slot', () => {
    const adRequestThrottling = throttle(10);
    adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-1'));
    expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(Sinon.match.func, 10 * 1000);

    expect(adRequestThrottling.isThrottled('slot-1')).to.be.true;
  });

  it('should throttle requests only for the throttle period', () => {
    const adRequestThrottling = throttle(10);
    adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-1'));

    expect(adRequestThrottling.isThrottled('slot-1')).to.be.true;
    sandbox.clock.tick(10 * 1000);
    expect(adRequestThrottling.isThrottled('slot-1')).to.be.false;
  });

  describe('includedDomIds', () => {
    it('should throttle requests only for the given ad slots if "includedDomIds" is set in the config', () => {
      const adRequestThrottling = throttle(20, ['slot-1']);
      adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-1'));
      adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-2'));

      expect(adRequestThrottling.isThrottled('slot-1')).to.be.true;
      expect(adRequestThrottling.isThrottled('slot-2')).to.be.false;
      sandbox.clock.tick(20 * 1000);
      expect(adRequestThrottling.isThrottled('slot-1')).to.be.false;
      expect(adRequestThrottling.isThrottled('slot-2')).to.be.false;
    });
    it('should throttle requests for all ad slots if "includedDomIds" is empty', () => {
      const adRequestThrottling = throttle(20, []);
      adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-1'));
      adRequestThrottling.onSlotRequested(slotRequestedEvent('slot-2'));

      expect(adRequestThrottling.isThrottled('slot-1')).to.be.true;
      expect(adRequestThrottling.isThrottled('slot-2')).to.be.true;
      sandbox.clock.tick(20 * 1000);
      expect(adRequestThrottling.isThrottled('slot-1')).to.be.false;
      expect(adRequestThrottling.isThrottled('slot-2')).to.be.false;
    });
  });
});
