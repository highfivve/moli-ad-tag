import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables, resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { auction } from 'ad-tag/types/moliConfig';
import {
  InterstitialChannel,
  interstitialChannelKey,
  interstitialChannels
} from 'ad-tag/ads/interstitial';

/**
 * Represents the current state of the interstitial ad format.
 *
 * - 'not-requested': Interstitial ad has not been requested yet. Neither through GAM nor through HB.
 * - 'gam': Interstitial has been rendered through GAM Web Interstitial.
 * - 'hb': Interstitial has been rendered through HB.
 * - 'empty': Interstitial has been requested but no ad was returned.
 */
type InterstitialState = 'not-requested' | InterstitialChannel | 'empty';

export interface InterstitialContext {
  /**
   *
   */
  interstitialState(): InterstitialState;

  /**
   * This is the main logic to determine if the interstitial ad format is allowed to be requested
   * and if yes, which channel should be used to request it.
   *
   * Different channels behave differently. GAM Web Interstitials are displayed on certain triggers,
   * like user navigation or visibility change of the site. Header Bidding interstitials are displayed
   * immediately after the auction is completed. The logic for header bidding interstitials lies in the
   * control of the ad tag itself.
   *
   * @param channel
   */
  isChannelAllowed(channel: InterstitialChannel): boolean;

  /**
   * Ad unit paths can contain variables that need to be resolved at runtime.
   * The global auction context and hence the frequency capping is initialized early on.
   * Once the `adUnitPathVariables` are available, this method should be called, so ad unit paths
   * can be resolved from the config and matched against the ad unit paths in the auction.
   *
   * @param adUnitPathVariables
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;

  /**
   * Check if an interstitial ad has been rendered through GAM.
   */
  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;
}

export const createInterstitialContext = (
  config: auction.InterstitialConfig
): InterstitialContext => {
  let interstitialAdUnitPath = config.adUnitPath;
  let currentInterstitialState: InterstitialState = 'not-requested';

  const updateAdUnitPaths = (variables: AdUnitPathVariables): void => {
    interstitialAdUnitPath = resolveAdUnitPath(config.adUnitPath, variables);
  };
  const onSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent): void => {
    // early return if the slot is not the interstitial ad unit
    if (event.slot.getAdUnitPath() !== interstitialAdUnitPath) {
      return;
    }

    if (event.isEmpty) {
      currentInterstitialState = 'empty';
    } else {
      const [value] = event.slot.getTargeting(interstitialChannelKey);
      if (value && interstitialChannels.includes(value as InterstitialChannel)) {
        currentInterstitialState = value as InterstitialChannel;
      } else {
        currentInterstitialState = 'not-requested';
      }
    }
  };

  const interstitialState = (): InterstitialState => {
    return currentInterstitialState;
  };

  const isChannelAllowed = (channel: InterstitialChannel): boolean => {
    return true;
  };

  return {
    interstitialState,
    isChannelAllowed,
    onSlotRenderEnded,
    updateAdUnitPaths
  };
};
