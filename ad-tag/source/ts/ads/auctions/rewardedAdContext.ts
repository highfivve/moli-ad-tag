import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables, resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { auction } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';

/**
 * The outcome of a single channel attempt within the rewarded ad waterfall.
 *
 * - 'granted': the user completed the ad and was granted the reward
 * - 'canceled': the user closed the ad before a reward was granted. Ends the waterfall
 *               as the user actively opted out.
 * - 'no-fill': the channel could not fill the request. The waterfall falls through to
 *              the next channel.
 */
type ChannelAttempt =
  | { readonly outcome: 'granted'; readonly payload: auction.RewardPayload }
  | { readonly outcome: 'canceled' }
  | { readonly outcome: 'no-fill' };

/**
 * Fallback payload if GAM grants a reward without payload information. The
 * `rewardedSlotGranted` event payload is nullable, but the public API contract guarantees
 * a payload on every `granted` result.
 */
const defaultRewardPayload: auction.RewardPayload = { amount: 1, type: 'reward' };

export interface RewardedAdContext {
  /**
   * Run the rewarded ad waterfall: attempt each configured channel in priority order,
   * falling through to the next channel on no-fill. Resolves once a channel grants the
   * reward, the user cancels, every channel is exhausted or the call is rejected because
   * another one is still in flight.
   *
   * Every business outcome - including no-fill - resolves. The promise only rejects on
   * unexpected technical exceptions, e.g. a crash in the underlying gpt.js integration.
   */
  requestRewardedAd(): Promise<MoliRuntime.RewardedAdResult>;

  /**
   * Ad unit paths can contain variables that need to be resolved at runtime.
   * The global auction context is initialized early on. Once the `adUnitPathVariables`
   * are available, this method should be called, so the gam ad unit path can be resolved.
   *
   * @param adUnitPathVariables
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;
}

export const createRewardedAdContext = (
  config: auction.RewardedAdConfig,
  window__: Window & googletag.IGoogleTagWindow,
  logger: MoliRuntime.MoliLogger
): RewardedAdContext => {
  let gamAdUnitPath = config.gam?.adUnitPath;
  let inFlight = false;

  /**
   * Attempt to fill the rewarded ad through Google Ad Manager Rewarded Ads for Web.
   *
   * - `slotRenderEnded.isEmpty` is a fast no-fill short-circuit
   * - otherwise wait up to `timeoutMs` for `rewardedSlotReady`, destroying the slot and
   *   treating the attempt as no-fill if the timeout elapses
   * - `granted` is sticky: a `rewardedSlotClosed` after `rewardedSlotGranted` only cleans
   *   up the slot and does not alter the result
   */
  const attemptGam = (gamConfig: auction.RewardedAdGamConfig): Promise<ChannelAttempt> =>
    new Promise<ChannelAttempt>(resolve => {
      window__.googletag.cmd.push(() => {
        const googletagRef = window__.googletag;
        const pubads = googletagRef.pubads();
        const adUnitPath = gamAdUnitPath ?? gamConfig.adUnitPath;
        const slot = googletagRef.defineOutOfPageSlot(
          adUnitPath,
          googletagRef.enums.OutOfPageFormat.REWARDED
        );

        if (!slot) {
          logger.error('rewardedAd', `failed to define rewarded slot for ${adUnitPath}`);
          resolve({ outcome: 'no-fill' });
          return;
        }

        let settled = false;
        let timeoutId: number | undefined;

        const destroySlot = (): void => googletagRef.destroySlots([slot]);

        const removeListeners = (): void => {
          pubads.removeEventListener('slotRenderEnded', onSlotRenderEnded);
          pubads.removeEventListener('rewardedSlotReady', onRewardedSlotReady);
          pubads.removeEventListener('rewardedSlotGranted', onRewardedSlotGranted);
          pubads.removeEventListener('rewardedSlotClosed', onRewardedSlotClosed);
        };

        const settle = (attempt: ChannelAttempt): void => {
          if (settled) {
            return;
          }
          settled = true;
          window__.clearTimeout(timeoutId);
          resolve(attempt);
        };

        const onSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent): void => {
          if (event.slot !== slot) {
            return;
          }
          // fast no-fill short-circuit - no need to wait for the timeout
          if (event.isEmpty) {
            logger.debug('rewardedAd', 'gam attempt has no fill');
            removeListeners();
            destroySlot();
            settle({ outcome: 'no-fill' });
          }
        };

        const onRewardedSlotReady = (event: googletag.events.IRewardedSlotReadyEvent): void => {
          if (event.slot !== slot) {
            return;
          }
          // the ad is ready. From here on the user controls how long the ad is visible,
          // so the timeout no longer applies
          window__.clearTimeout(timeoutId);
          logger.debug('rewardedAd', 'gam rewarded slot ready');
          event.makeRewardedVisible();
        };

        const onRewardedSlotGranted = (event: googletag.events.IRewardedSlotGrantedEvent): void => {
          if (event.slot !== slot) {
            return;
          }
          const payload: auction.RewardPayload = event.payload ?? defaultRewardPayload;
          logger.debug('rewardedAd', 'gam granted reward', payload);
          // granted is sticky: the rewardedSlotClosed listener stays registered and only
          // cleans up the slot
          settle({ outcome: 'granted', payload });
        };

        const onRewardedSlotClosed = (event: googletag.events.IRewardedSlotClosedEvent): void => {
          if (event.slot !== slot) {
            return;
          }
          logger.debug('rewardedAd', 'gam rewarded slot closed');
          removeListeners();
          destroySlot();
          settle({ outcome: 'canceled' });
        };

        pubads.addEventListener('slotRenderEnded', onSlotRenderEnded);
        pubads.addEventListener('rewardedSlotReady', onRewardedSlotReady);
        pubads.addEventListener('rewardedSlotGranted', onRewardedSlotGranted);
        pubads.addEventListener('rewardedSlotClosed', onRewardedSlotClosed);

        timeoutId = window__.setTimeout(() => {
          logger.debug(
            'rewardedAd',
            `gam attempt timed out after ${config.timeoutMs}ms without a rewardedSlotReady event`
          );
          removeListeners();
          destroySlot();
          settle({ outcome: 'no-fill' });
        }, config.timeoutMs);

        slot.addService(pubads);
        googletagRef.display(slot);
      });
    });

  const attemptChannel = (channel: auction.RewardedAdChannel): Promise<ChannelAttempt> => {
    switch (channel) {
      case 'gam':
        // a channel without its configuration block is skipped ("not configured" is a
        // business outcome, not an error)
        return config.gam ? attemptGam(config.gam) : Promise.resolve({ outcome: 'no-fill' });
      case 'welect':
        // not implemented yet - falls through the waterfall
        return Promise.resolve({ outcome: 'no-fill' });
    }
  };

  const requestRewardedAd = async (): Promise<MoliRuntime.RewardedAdResult> => {
    if (inFlight) {
      return { state: 'error', reason: 'already-in-progress' };
    }
    if (!config.enabled || config.priority.length === 0) {
      return { state: 'empty' };
    }
    inFlight = true;
    try {
      for (const channel of config.priority) {
        const attempt = await attemptChannel(channel);
        switch (attempt.outcome) {
          case 'granted':
            return { state: 'granted', channel, payload: attempt.payload };
          case 'canceled':
            return { state: 'canceled', channel };
          case 'no-fill':
            // fall through to the next channel
            break;
        }
      }
      return { state: 'empty' };
    } finally {
      inFlight = false;
    }
  };

  return {
    requestRewardedAd,
    updateAdUnitPaths: (variables: AdUnitPathVariables): void => {
      if (config.gam) {
        gamAdUnitPath = resolveAdUnitPath(config.gam.adUnitPath, variables);
      }
    }
  };
};
