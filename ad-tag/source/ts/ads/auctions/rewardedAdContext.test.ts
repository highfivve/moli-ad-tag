import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { createRewardedAdContext, RewardedAdContext } from 'ad-tag/ads/auctions/rewardedAdContext';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { auction } from 'ad-tag/types/moliConfig';
import { welect } from 'ad-tag/types/welect';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';

use(sinonChai);

describe('RewardedAdContext', () => {
  const sandbox = Sinon.createSandbox();

  const adUnitPath = '/123/rewarded';
  const timeoutMs = 5000;

  const { jsDomWindow } = createDomAndWindow();

  const bundleUrl = 'https://static.welect.de/p/bundles/example.js';
  const welectPayload: auction.RewardPayload = { amount: 1, type: 'article' };

  let slot: googletag.IAdSlot;
  let listeners: Map<string, Array<(event: any) => void>>;
  let defineOutOfPageSlotStub: Sinon.SinonStub;
  let destroySlotsSpy: Sinon.SinonSpy;
  let displaySpy: Sinon.SinonSpy;
  let refreshSpy: Sinon.SinonSpy;
  let timeouts: Array<{ callback: () => void; delay: number; id: number }>;
  let timeoutCallback: (() => void) | undefined;
  let timeoutDelay: number | undefined;
  let clearTimeoutStub: Sinon.SinonStub;

  let checkTokenStub: Sinon.SinonStub;
  let checkAvailabilityStub: Sinon.SinonStub;
  let runSessionStub: Sinon.SinonStub;
  let loadScriptStub: Sinon.SinonStub;
  let assetLoaderService: IAssetLoaderService;

  const emit = (eventType: string, event: any): void => {
    (listeners.get(eventType) ?? []).slice().forEach(listener => listener(event));
  };

  /** await the microtask chain of the lazy welect bundle loading */
  const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const availabilityCallbacks = (): welect.CheckAvailabilityConfig =>
    checkAvailabilityStub.lastCall.args[0];

  const sessionCallbacks = (): welect.RunSessionConfig => runSessionStub.lastCall.args[0];

  const tokenCallbacks = (): welect.CheckTokenConfig => checkTokenStub.lastCall.args[0];

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
    jsDomWindow.Welect = undefined;
    slot = googleAdSlotStub(adUnitPath, 'rewarded-slot');
    listeners = new Map();
    timeouts = [];
    timeoutCallback = undefined;
    timeoutDelay = undefined;

    checkTokenStub = sandbox.stub();
    checkAvailabilityStub = sandbox.stub();
    runSessionStub = sandbox.stub();
    loadScriptStub = sandbox.stub().callsFake(() => {
      jsDomWindow.Welect = {
        checkToken: checkTokenStub,
        checkAvailability: checkAvailabilityStub,
        runSession: runSessionStub
      };
      return Promise.resolve();
    });
    assetLoaderService = {
      loadScript: loadScriptStub,
      loadJson: sandbox.stub().rejects(new Error('not implemented'))
    };

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
    refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

    sandbox.stub(jsDomWindow, 'setTimeout').callsFake(((callback: () => void, delay: number) => {
      const id = 42 + timeouts.length;
      timeouts.push({ callback, delay, id });
      timeoutCallback = callback;
      timeoutDelay = delay;
      return id;
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
    return createRewardedAdContext(config, jsDomWindow, noopLogger, assetLoaderService);
  };

  const welectConfig = (
    configOverride?: Partial<auction.RewardedAdWelectConfig>
  ): auction.RewardedAdWelectConfig => ({
    bundleUrl,
    payload: welectPayload,
    ...configOverride
  });

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

    it('should resolve empty if the welect channel is prioritized but not configured', async () => {
      const context = rewardedAdContext({ priority: ['welect'], gam: undefined });
      const result = await context.requestRewardedAd();
      expect(result).to.deep.equal({ state: 'empty' });
      expect(loadScriptStub).to.have.not.been.called;
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
      expect(refreshSpy).to.have.been.calledOnceWithExactly([slot]);
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

  describe('welect channel', () => {
    const welectOnlyContext = (
      welectConfigOverride?: Partial<auction.RewardedAdWelectConfig>
    ): RewardedAdContext =>
      rewardedAdContext({
        priority: ['welect'],
        gam: undefined,
        welect: welectConfig({ checkToken: false, ...welectConfigOverride })
      });

    it('should lazy load the welect bundle on first use and run a session', async () => {
      const context = welectOnlyContext();
      expect(loadScriptStub).to.have.not.been.called;

      const result = context.requestRewardedAd();
      await flushMicrotasks();

      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub.firstCall.args[0]).to.deep.include({
        name: 'welect',
        assetUrl: bundleUrl
      });

      availabilityCallbacks().onAvailable();
      sessionCallbacks().onSuccess();

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });
    });

    it('should not load the welect bundle if the publisher already preloaded it', async () => {
      jsDomWindow.Welect = {
        checkToken: checkTokenStub,
        checkAvailability: checkAvailabilityStub,
        runSession: runSessionStub
      };
      const context = welectOnlyContext();
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      expect(loadScriptStub).to.have.not.been.called;

      availabilityCallbacks().onAvailable();
      sessionCallbacks().onSuccess();

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });
    });

    it('should load the welect bundle only once across multiple calls', async () => {
      const context = welectOnlyContext();

      const first = context.requestRewardedAd();
      await flushMicrotasks();
      availabilityCallbacks().onUnavailable();
      expect(await first).to.deep.equal({ state: 'empty' });

      const second = context.requestRewardedAd();
      await flushMicrotasks();
      availabilityCallbacks().onUnavailable();
      expect(await second).to.deep.equal({ state: 'empty' });

      expect(loadScriptStub).to.have.been.calledOnce;
    });

    it('should resolve canceled if the user aborts the welect session', async () => {
      const context = welectOnlyContext();
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      availabilityCallbacks().onAvailable();
      sessionCallbacks().onAbort();

      expect(await result).to.deep.equal({ state: 'canceled', channel: 'welect' });
    });

    it('should resolve empty if welect is unavailable', async () => {
      const context = welectOnlyContext();
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      availabilityCallbacks().onUnavailable();

      expect(await result).to.deep.equal({ state: 'empty' });
      expect(runSessionStub).to.have.not.been.called;
    });

    it('should treat a failed bundle load as no-fill and retry the download on the next call', async () => {
      loadScriptStub.rejects(new Error('network error'));
      const context = welectOnlyContext();

      expect(await context.requestRewardedAd()).to.deep.equal({ state: 'empty' });

      // the failed load must not be cached - the next call retries the download
      loadScriptStub.callsFake(() => {
        jsDomWindow.Welect = {
          checkToken: checkTokenStub,
          checkAvailability: checkAvailabilityStub,
          runSession: runSessionStub
        };
        return Promise.resolve();
      });
      const second = context.requestRewardedAd();
      await flushMicrotasks();
      availabilityCallbacks().onAvailable();
      sessionCallbacks().onSuccess();

      expect(await second).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });
      expect(loadScriptStub).to.have.been.calledTwice;
    });

    it('should treat a bundle that does not define window.Welect as no-fill', async () => {
      loadScriptStub.callsFake(() => Promise.resolve());
      const context = welectOnlyContext();
      expect(await context.requestRewardedAd()).to.deep.equal({ state: 'empty' });
    });

    it('should treat a bundle without checkAvailability/runSession as no-fill', async () => {
      loadScriptStub.callsFake(() => {
        jsDomWindow.Welect = { checkToken: checkTokenStub };
        return Promise.resolve();
      });
      const context = welectOnlyContext();
      expect(await context.requestRewardedAd()).to.deep.equal({ state: 'empty' });
      expect(runSessionStub).to.have.not.been.called;
    });

    it('should resolve empty if no availability result arrives within the timeout', async () => {
      const context = welectOnlyContext();
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      expect(timeoutDelay).to.equal(timeoutMs);
      timeoutCallback!();

      expect(await result).to.deep.equal({ state: 'empty' });

      // a late availability result must not open the ad chooser anymore
      availabilityCallbacks().onAvailable();
      expect(runSessionStub).to.have.not.been.called;
    });

    it('should clear the timeout once the session is available - the user controls the duration', async () => {
      const context = welectOnlyContext();
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      const attemptTimeoutId = timeouts[timeouts.length - 1].id;
      availabilityCallbacks().onAvailable();
      expect(clearTimeoutStub).to.have.been.calledWithExactly(attemptTimeoutId);

      sessionCallbacks().onSuccess();
      await result;
    });
  });

  describe('welect token preflight', () => {
    it('should short-circuit the whole waterfall to granted on a valid token', async () => {
      const context = rewardedAdContext({
        priority: ['gam', 'welect'],
        welect: welectConfig()
      });

      const result = context.requestRewardedAd();
      await flushMicrotasks();
      tokenCallbacks().onValid();

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });

      // no ad is shown on any channel
      expect(defineOutOfPageSlotStub).to.have.not.been.called;
      expect(checkAvailabilityStub).to.have.not.been.called;
      expect(runSessionStub).to.have.not.been.called;
    });

    it('should proceed with the waterfall on an invalid token', async () => {
      const context = rewardedAdContext({
        priority: ['gam', 'welect'],
        welect: welectConfig()
      });

      const result = context.requestRewardedAd();
      await flushMicrotasks();
      tokenCallbacks().onInvalid();
      await flushMicrotasks();
      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
      expect(checkTokenStub).to.have.been.calledOnce;
    });

    it('should treat a bundle without a checkToken method as an invalid token', async () => {
      loadScriptStub.callsFake(() => {
        jsDomWindow.Welect = {
          checkAvailability: checkAvailabilityStub,
          runSession: runSessionStub
        };
        return Promise.resolve();
      });
      const context = rewardedAdContext({
        priority: ['gam', 'welect'],
        welect: welectConfig()
      });

      const result = context.requestRewardedAd();
      await flushMicrotasks();
      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should never check the token if checkToken is false', async () => {
      const context = rewardedAdContext({
        priority: ['welect'],
        gam: undefined,
        welect: welectConfig({ checkToken: false })
      });

      const result = context.requestRewardedAd();
      await flushMicrotasks();

      availabilityCallbacks().onAvailable();
      sessionCallbacks().onSuccess();

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });
      expect(checkTokenStub).to.have.not.been.called;
    });

    it('should not load the welect bundle if welect is not prioritized', async () => {
      const context = rewardedAdContext({ priority: ['gam'], welect: welectConfig() });
      const result = context.requestRewardedAd();

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });
      await result;

      expect(loadScriptStub).to.have.not.been.called;
      expect(checkTokenStub).to.have.not.been.called;
    });

    it('should proceed with the waterfall if the preflight times out on a hanging bundle load', async () => {
      // a bundle download that never settles
      loadScriptStub.callsFake(() => new Promise(() => undefined));
      const context = rewardedAdContext({
        priority: ['gam', 'welect'],
        welect: welectConfig()
      });

      const result = context.requestRewardedAd();
      await flushMicrotasks();

      // the preflight timeout releases the waterfall
      expect(timeouts).to.have.length(1);
      expect(timeouts[0].delay).to.equal(timeoutMs);
      timeouts[0].callback();
      await flushMicrotasks();

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });
      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });
  });

  describe('waterfall', () => {
    it('should fall through an unconfigured welect channel to gam', async () => {
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

    it('should fall through from gam to welect on gam no-fill', async () => {
      const context = rewardedAdContext({
        priority: ['gam', 'welect'],
        welect: welectConfig({ checkToken: false })
      });
      const result = context.requestRewardedAd();

      emit('slotRenderEnded', { slot, isEmpty: true });
      await flushMicrotasks();

      availabilityCallbacks().onAvailable();
      sessionCallbacks().onSuccess();

      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'welect',
        payload: welectPayload
      });
    });

    it('should fall through from welect to gam if welect is unavailable', async () => {
      const context = rewardedAdContext({
        priority: ['welect', 'gam'],
        welect: welectConfig({ checkToken: false })
      });
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      availabilityCallbacks().onUnavailable();
      await flushMicrotasks();

      emit('rewardedSlotGranted', { slot, payload: { amount: 5, type: 'coin' } });
      expect(await result).to.deep.equal({
        state: 'granted',
        channel: 'gam',
        payload: { amount: 5, type: 'coin' }
      });
    });

    it('should give every channel its own timeout budget, independent of its position', async () => {
      const context = rewardedAdContext({
        priority: ['welect', 'gam'],
        welect: welectConfig({ checkToken: false })
      });
      const result = context.requestRewardedAd();
      await flushMicrotasks();

      // the welect attempt times out after its full budget
      expect(timeouts).to.have.length(1);
      expect(timeouts[0].delay).to.equal(timeoutMs);
      timeouts[0].callback();
      await flushMicrotasks();

      // the gam attempt gets a fresh, full budget - a slow first channel does not starve it
      expect(timeouts).to.have.length(2);
      expect(timeouts[1].delay).to.equal(timeoutMs);
      timeouts[1].callback();

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
