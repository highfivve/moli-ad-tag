import { prebidjs } from '../types/prebidjs';
import { getDefaultLogger } from '../util/logging';

/**
 * These types are copied from prebid-outstream.
 */

export type OutStreamPlayerWindow = {
  /**
   * Set by prebid-outstream as soon as it is loaded from the configured url below.
   */
  outstreamPlayer?: (
    bid: PrebidOutstreamBid,
    elementId: string,
    config: PrebidOutstreamConfiguration
  ) => void;
};

declare const window: Window & OutStreamPlayerWindow;

export type PrebidOutstreamConfiguration = Partial<{
  width: number;
  height: number;
  vastTimeout: number;
  maxAllowedVastTagRedirects: number;
  allowVpaid: boolean;
  autoPlay: boolean;
  preload: boolean;
  mute: boolean;
  adText: string;
}>;

export type PrebidOutstreamBid = Partial<{
  ad: string | null;
  vastXml: string;
  id: string;
  impid: string;
  price: number;
  adm: string;
  adomain: string[];
  cid: string;
  crid: string;
  ext: {
    dspid: number;
    advid: number;
  };
  renderer: { push: (func: () => void) => void };
}>;

/**
 * Renderer for Moli's built in outstream player.
 *
 * Usage is like this:
 *
 * ```
 * adUnit: {
 *   mediaTypes: {
 *     video: {
 *       renderer: prebidOutstreamRenderer('prebid-adslot')
 *     }
 *   }
 * }
 * ```
 *
 * If needed, values can be overriden like this:
 *
 * ```
 * renderer: { ...prebidOutstreamRenderer('prebid-adslot'), url: 'another-url.net' }
 * ```
 *
 * @param domId Must match the domId of the respective ad slot.
 * @param url URL to the outstream player.
 * @param config Configuration for the outstream player.
 */
export const prebidOutstreamRenderer = (
  domId: string,
  url: string,
  config: PrebidOutstreamConfiguration = {}
): prebidjs.IRenderer => ({
  url: url,
  render: bid => renderPrebidOutstream(bid, domId, config),
  backupOnly: true
});

/**
 * Renders the prebid outstream player directly, using the specified parameters.
 */
export const renderPrebidOutstream = (
  bid: PrebidOutstreamBid,
  domId: string,
  config: PrebidOutstreamConfiguration = {}
) => {
  if (!bid.renderer) {
    getDefaultLogger().error(
      'Can not initialize prebid outstream player, because bid.renderer is not defined'
    );
    return;
  }
  bid.renderer.push(() => window.outstreamPlayer?.(bid, domId, config));
};
