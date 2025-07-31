/**
 * ## Interstitial channels
 *
 * A channel is the type of integration, which the ad will be rendered through.
 * Note that the enum values are strings, so they can be used as targeting keys in GAM.
 *
 */
export const enum InterstitialChannel {
  GoogleWebInterstitial = '0',
  CustomRenderedInterstitial = '1'
}

export const interstitialChannelKey = 'intstl';
export const interstitialChannels: InterstitialChannel[] = [
  InterstitialChannel.GoogleWebInterstitial,
  InterstitialChannel.CustomRenderedInterstitial
];
