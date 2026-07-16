import { googletag } from 'ad-tag/types/googletag';
import { welect } from 'ad-tag/types/welect';
import { AdUnitPathVariables, resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { auction } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AssetLoadMethod, IAssetLoaderService } from 'ad-tag/util/assetLoaderService';

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
  window__: Window & googletag.IGoogleTagWindow & welect.WelectWindow,
  logger: MoliRuntime.MoliLogger,
  assetLoaderService: IAssetLoaderService
): RewardedAdContext => {
  let gamAdUnitPath = config.gam?.adUnitPath;
  let inFlight = false;

  /**
   * The Welect SDK bundle is lazy-loaded on first actual use, not eagerly on pipeline init.
   * The promise is cached so subsequent attempts reuse the already loaded bundle. A failed
   * load clears the cache, so a later `rewardedAd()` call retries the download.
   */
  let welectBundle: Promise<welect.Welect> | undefined;

  const loadWelectSdk = (welectConfig: auction.RewardedAdWelectConfig): Promise<welect.Welect> => {
    // the publisher may have preloaded the welect bundle - never load it a second time
    const preloadedApi = window__.Welect;
    if (preloadedApi) {
      return Promise.resolve(preloadedApi);
    }
    welectBundle =
      welectBundle ??
      assetLoaderService
        .loadScript({
          name: 'welect',
          assetUrl: welectConfig.bundleUrl,
          loadMethod: AssetLoadMethod.TAG
        })
        .then(() => {
          const welectApi = window__.Welect;
          return welectApi
            ? Promise.resolve(welectApi)
            : Promise.reject(new Error('welect bundle loaded, but window.Welect is not defined'));
        })
        .catch(error => {
          welectBundle = undefined;
          return Promise.reject(error);
        });
    return welectBundle;
  };

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

  /**
   * Check if the user already holds a valid Welect token, i.e. already earned the reward in
   * this session. Bounded by `timeoutMs` - a hanging bundle download must not stall the
   * whole waterfall, so on timeout or a failed load the preflight reports no valid token
   * and the waterfall proceeds.
   */
  const hasValidWelectToken = (welectConfig: auction.RewardedAdWelectConfig): Promise<boolean> =>
    new Promise<boolean>(resolve => {
      let settled = false;
      const settle = (validToken: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        window__.clearTimeout(timeoutId);
        resolve(validToken);
      };
      const timeoutId = window__.setTimeout(() => {
        logger.debug('rewardedAd', `welect token preflight timed out after ${config.timeoutMs}ms`);
        settle(false);
      }, config.timeoutMs);

      loadWelectSdk(welectConfig)
        .then(welectApi => {
          const checkToken = welectApi.checkToken;
          if (!checkToken) {
            logger.error('rewardedAd', 'welect bundle does not provide checkToken');
            settle(false);
            return;
          }
          checkToken({
            onValid: () => settle(true),
            onInvalid: () => settle(false)
          });
        })
        .catch(error => {
          logger.error('rewardedAd', 'welect token preflight failed', error);
          settle(false);
        });
    });

  /**
   * Attempt to fill the rewarded ad through the Welect Ad Chooser.
   *
   * - the `timeoutMs` budget covers the bundle download and the `checkAvailability` call.
   *   Once the session runs, the user controls how long it takes, so the timeout no
   *   longer applies (same semantics as the gam channel after `rewardedSlotReady`)
   * - `onUnavailable` and a failed bundle load are no-fill - the waterfall falls through
   * - `runSession`: `onSuccess` grants the static configured payload, `onAbort` cancels
   */
  const attemptWelect = (welectConfig: auction.RewardedAdWelectConfig): Promise<ChannelAttempt> =>
    new Promise<ChannelAttempt>(resolve => {
      let settled = false;
      const settle = (attempt: ChannelAttempt): void => {
        if (settled) {
          return;
        }
        settled = true;
        window__.clearTimeout(timeoutId);
        resolve(attempt);
      };
      const timeoutId = window__.setTimeout(() => {
        logger.debug(
          'rewardedAd',
          `welect attempt timed out after ${config.timeoutMs}ms without an availability result`
        );
        settle({ outcome: 'no-fill' });
      }, config.timeoutMs);

      loadWelectSdk(welectConfig)
        .then(welectApi => {
          if (settled) {
            // the attempt already timed out while the bundle was loading
            return;
          }
          const checkAvailability = welectApi.checkAvailability;
          const runSession = welectApi.runSession;
          if (!checkAvailability || !runSession) {
            // all SDK methods are optional - a bundle without them cannot serve an ad
            logger.error(
              'rewardedAd',
              'welect bundle does not provide checkAvailability/runSession'
            );
            settle({ outcome: 'no-fill' });
            return;
          }
          checkAvailability({
            onAvailable: () => {
              if (settled) {
                // the attempt already timed out - do not open the ad chooser anymore
                return;
              }
              // the session is available. From here on the user controls how long the
              // session takes, so the timeout no longer applies
              window__.clearTimeout(timeoutId);
              logger.debug('rewardedAd', 'welect session available');
              runSession({
                onSuccess: () => {
                  logger.debug('rewardedAd', 'welect granted reward', welectConfig.payload);
                  settle({ outcome: 'granted', payload: welectConfig.payload });
                },
                onAbort: () => {
                  logger.debug('rewardedAd', 'welect session aborted');
                  settle({ outcome: 'canceled' });
                }
              });
            },
            onUnavailable: () => {
              logger.debug('rewardedAd', 'welect attempt has no fill');
              settle({ outcome: 'no-fill' });
            }
          });
        })
        .catch(error => {
          logger.error('rewardedAd', 'failed to load the welect bundle', error);
          settle({ outcome: 'no-fill' });
        });
    });

  const attemptChannel = (channel: auction.RewardedAdChannel): Promise<ChannelAttempt> => {
    // a channel without its configuration block is skipped ("not configured" is a
    // business outcome, not an error)
    switch (channel) {
      case 'gam':
        return config.gam ? attemptGam(config.gam) : Promise.resolve({ outcome: 'no-fill' });
      case 'welect':
        return config.welect
          ? attemptWelect(config.welect)
          : Promise.resolve({ outcome: 'no-fill' });
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
      // welect token preflight: a valid existing token short-circuits the whole waterfall to
      // granted with the configured static payload, no ad shown. This avoids re-annoying
      // users that already earned the reward in this session.
      const welectConfig = config.welect;
      if (
        welectConfig &&
        config.priority.includes('welect') &&
        welectConfig.checkToken !== false &&
        (await hasValidWelectToken(welectConfig))
      ) {
        logger.debug('rewardedAd', 'valid welect token - granting without an ad');
        return { state: 'granted', channel: 'welect', payload: welectConfig.payload };
      }

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
