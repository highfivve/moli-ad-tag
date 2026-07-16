import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { createRewardedAdContext, RewardedAdContext } from 'ad-tag/ads/auctions/rewardedAdContext';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { auction } from 'ad-tag/types/moliConfig';
import { noopLogger } from 'ad-tag/stubs/moliStubs';

use(sinonChai);

describe('RewardedAdContext', () => {
  const sandbox = Sinon.createSandbox();

  const adUnitPath = '/123/rewarded';
  const timeoutMs = 5000;

  const { jsDomWindow } = createDomAndWindow();

  let slot: googletag.IAdSlot;
  let listeners: Map<string, Array<(event: any) => void>>;
  let defineOutOfPageSlotStub: Sinon.SinonStub;
  let destroySlotsSpy: Sinon.SinonSpy;
  let displaySpy: Sinon.SinonSpy;
  let timeoutCallback: (() => void) | undefined;
  let timeoutDelay: number | undefined;
  let clearTimeoutStub: Sinon.SinonStub;

  const emit = (eventType: string, event: any): void => {
    (listeners.get(eventType) ?? []).slice().forEach(listener => listener(event));
  };

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
    slot = googleAdSlotStub(adUnitPath, 'rewarded-slot');
    listeners = new Map();
    timeoutCallback = undefined;
    timeoutDelay = undefined;

    const pubads = jsDomWindow.googletag.pubads();
    sandbox.stub(pubads, 'addEventListener').callsFake(((eventType: string, listener: any) => {
      listeners.set(eventType, [...(listeners.get(eventType) ?? []), listener]);
      return pubads;
    }) as any);
    sandbox.stub(pubads, 'removeEventListener').callsFake(((eventType: string, listener: any) => {
      listeners.set(
        eventType,
        (listeners.get(eventType) ?? []).filter(existing => existing !== listener)
      );
      return true;
    }) as any);

    defineOutOfPageSlotStub = sandbox
      .stub(jsDomWindow.googletag, 'defineOutOfPageSlot')
      .returns(slot);
    destroySlotsSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
    displaySpy = sandbox.spy(jsDomWindow.googletag, 'display');

    sandbox.stub(jsDomWindow, 'setTimeout').callsFake(((callback: () => void, delay: number) => {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 42;
    }) as any);
    clearTimeoutStub = sandbox.stub(jsDomWindow, 'clearTimeout');
  });

  afterEach(() => {
    sandbox.restore();
  });

  const rewardedAdContext = (
    configOverride?: Partial<auction.RewardedAdConfig>
  ): RewardedAdContext => {
    const config: auction.RewardedAdConfig = {
      enabled: true,
      priority: ['gam'],
      timeoutMs,
      gam: { adUnitPath },
      ...configOverride
    };
    return createRewardedAdContext(config, jsDomWindow, noopLogger);
  };

  describe('config validation', () => {
    it('should resolve empty if the config is disabled', async () => {
      const context = rewardedAdContext({ enabled: false });
      const result = await context.requestRewardedAd();
      expect(result).to.deep.equal({ state: 'empty' });
      expect(defineOutOfPageSlotStub).to.have.not.been.called;
    });

    it('should resolve empty if the priority is empty', async () => {
      const context = rewardedAdContext({ priority: [] });
      const result = await context.requestRewardedAd();
      expect(result).to.deep.equal({ state: 'empty' });
      expect(defineOutOfPageSlotStub).to.have.not.been.called;
    });

    it('should resolve empty if the gam channel is prioritized but not configured', async () => {
      const context = rewardedAdContext({ gam: undefined });
      const result = await context.requestRewardedAd();
      expect(result).to.deep.equal({ state: 'empty' });
      expect(defineOutOfPageSlotStub).to.have.not.been.called;
    });
  });

  describe('gam channel', () => {
    it('should define a rewarded out-of-page slot and display it', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(
        adUnitPath,
        jsDomWindow.googletag.enums.OutOfPageFormat.REWARDED
      );
      expect(displaySpy).to.have.been.calledOnceWithExactly(slot);
      expect(timeoutDelay).to.equal(timeoutMs);

      emit('rewardedSlotGranted', { slot, payload: { amount: 1, type: 'coin' } });
      await result;
    });

    it('should resolve granted with the payload from the rewardedSlotGranted event', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should resolve granted with a default payload if the event payload is null', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('rewardedSlotGranted', { slot, payload: null });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 1, type: 'reward' }
      });
    });

    it('should keep granted sticky if rewardedSlotClosed fires afterwards and destroy the slot', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });
      emit('rewardedSlotClosed', { slot });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
      expect(destroySlotsSpy).to.have.been.calledOnceWithExactly([slot]);
    });

    it('should resolve canceled if the user closes the ad before a reward is granted', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('rewardedSlotClosed', { slot });

      expect(await result).to.deep.equal({ state: 'canceled', channel: 'gam' });
      expect(destroySlotsSpy).to.have.been.calledOnceWithExactly([slot]);
    });

    it('should resolve empty on slotRenderEnded with isEmpty and destroy the slot', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('slotRenderEnded', { slot, isEmpty: true });

      expect(await result).to.deep.equal({ state: 'empty' });
      expect(destroySlotsSpy).to.have.been.calledOnceWithExactly([slot]);
    });

    it('should resolve empty and destroy the slot if no rewardedSlotReady arrives within the timeout', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      expect(timeoutCallback).to.exist;
      timeoutCallback!();

      expect(await result).to.deep.equal({ state: 'empty' });
      expect(destroySlotsSpy).to.have.been.calledOnceWithExactly([slot]);
    });

    it('should make the ad visible and clear the timeout on rewardedSlotReady', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      const makeRewardedVisible = sandbox.spy();
      emit('rewardedSlotReady', { slot, makeRewardedVisible });

      expect(makeRewardedVisible).to.have.been.calledOnce;
      expect(clearTimeoutStub).to.have.been.calledWithExactly(42);

      emit('rewardedSlotGranted', { slot, payload: { amount: 1, type: 'coin' } });
      await result;
    });

    it('should ignore events of other slots', async () => {
      const otherSlot = googleAdSlotStub('/123/other', 'other-slot');
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('slotRenderEnded', { slot: otherSlot, isEmpty: true });
      emit('rewardedSlotClosed', { slot: otherSlot });
      emit('rewardedSlotGranted', { slot: otherSlot, payload: { amount: 99, type: 'coin' } });

      // still unsettled - our slot grants the reward
      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should resolve empty if the rewarded slot could not be defined', async () => {
      defineOutOfPageSlotStub.returns(null);
      const context = rewardedAdContext();
      const result = await context.requestRewardedAd();
      expect(result).to.deep.equal({ state: 'empty' });
    });

    it('should remove all event listeners once the attempt settled with no-fill', async () => {
      const context = rewardedAdContext();
      const result = context.requestRewardedAd();

      emit('slotRenderEnded', { slot, isEmpty: true });
      await result;

      expect(listeners.get('slotRenderEnded')).to.be.empty;
      expect(listeners.get('rewardedSlotReady')).to.be.empty;
      expect(listeners.get('rewardedSlotGranted')).to.be.empty;
      expect(listeners.get('rewardedSlotClosed')).to.be.empty;
    });

    it('should resolve the gam ad unit path with the provided ad unit path variables', async () => {
      const context = rewardedAdContext({ gam: { adUnitPath: '/123/content_1/{device}' } });
      context.updateAdUnitPaths({ device: 'mobile', domain: 'example.com' });

      const result = context.requestRewardedAd();
      expect(defineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(
        '/123/content_1/mobile',
        jsDomWindow.googletag.enums.OutOfPageFormat.REWARDED
      );

      emit('slotRenderEnded', { slot, isEmpty: true });
      await result;
    });
  });

  describe('waterfall', () => {
    it('should fall through a not yet supported welect channel to gam', async () => {
      const context = rewardedAdContext({ priority: ['welect', 'gam'] });
      const result = context.requestRewardedAd();

      // the welect attempt resolves in a microtask - wait one tick until the gam attempt starts
      await Promise.resolve();
      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should resolve empty if all channels have no fill', async () => {
      const context = rewardedAdContext({ priority: ['welect', 'gam'] });
      const result = context.requestRewardedAd();

      // the welect attempt resolves in a microtask - wait one tick until the gam attempt starts
      await Promise.resolve();
      emit('slotRenderEnded', { slot, isEmpty: true });

      expect(await result).to.deep.equal({ state: 'empty' });
    });
  });

  describe('concurrency', () => {
    it('should resolve a second concurrent call with already-in-progress without disturbing the first call', async () => {
      const context = rewardedAdContext();
      const first = context.requestRewardedAd();

      const second = await context.requestRewardedAd();
      expect(second).to.deep.equal({ state: 'error', reason: 'already-in-progress' });

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });
      expect(await first).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should reset the in-flight guard if a channel attempt crashes', async () => {
      const error = new Error('gpt crashed');
      defineOutOfPageSlotStub.throws(error);
      const context = rewardedAdContext();

      const crashed = await context.requestRewardedAd().then(
        () => null,
        e => e
      );
      expect(crashed).to.equal(error);

      // the in-flight guard must be released - a new call must run a fresh gam attempt
      // instead of resolving with already-in-progress
      defineOutOfPageSlotStub.returns(slot);
      const second = context.requestRewardedAd();
      emit('rewardedSlotGranted', { slot, payload: { amount: 3, type: 'coin' } });

      expect(await second).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 3, type: 'coin' }
      });
    });

    it('should allow a new call after the previous one settled', async () => {
      const context = rewardedAdContext();
      const first = context.requestRewardedAd();
      emit('slotRenderEnded', { slot, isEmpty: true });
      expect(await first).to.deep.equal({ state: 'empty' });

      const second = context.requestRewardedAd();
      emit('rewardedSlotGranted', { slot, payload: { amount: 2, type: 'coin' } });
      expect(await second).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 2, type: 'coin' }
      });
    });
  });
});
