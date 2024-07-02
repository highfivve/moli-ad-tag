import { expect, use } from 'chai';
import { FrequencyCapping } from './frequencyCapping';
import { prebidjs } from '../../types/prebidjs';
import BidObject = prebidjs.event.BidObject;
import { createDom } from '../../stubs/browserEnvSetup';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
use(sinonChai);

describe('FrequencyCapping', () => {
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');

  let frequencyCapping: FrequencyCapping;
  const configs = [
    {
      bidder: prebidjs.DSPX,
      domId: 'wp-slot',
      blockedForMs: 10000
    }
  ];

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.useFakeTimers();
    frequencyCapping = new FrequencyCapping(
      {
        enabled: true,
        configs
      },
      jsDomWindow
    );
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  it('should not add a frequency cap if no events have been fired', () => {
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
  });

  it('should not add a frequency cap if the configured bidder did not win the auction on the slot', () => {
    const bid: BidObject = {
      bidder: prebidjs.GumGum,
      adUnitCode: 'wp-slot'
    } as BidObject;

    frequencyCapping.onBidWon(bid, configs);

    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
  });

  it('should add a frequency cap when a bid is won on the configured slot', () => {
    const bid: BidObject = {
      bidder: prebidjs.DSPX,
      adUnitCode: 'wp-slot'
    } as BidObject;

    frequencyCapping.onBidWon(bid, configs);
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.true;
  });

  it('should remove the frequency cap after the specified timeout', () => {
    const bid: BidObject = {
      bidder: prebidjs.DSPX,
      adUnitCode: 'wp-slot'
    } as BidObject;

    frequencyCapping.onBidWon(bid, configs);
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.true;

    sandbox.clock.tick(11000);
    expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(Sinon.match.func, 10000);
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
  });
});
