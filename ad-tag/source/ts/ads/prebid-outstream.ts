import { prebidjs } from '../types/prebidjs';

/**
 * These types are copied from prebid-outstream.
 */

type OutStreamPlayerWindow = {
  /**
   * Set by prebid-outstream as soon as it is loaded from the configured url below.
   */
  outstreamPlayer?: (bid: Bid, elementId: string, config: GenericConfiguration) => void;
};

declare const window: Window & OutStreamPlayerWindow;

export type GenericConfiguration = Partial<{
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

type Bid = Partial<{
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
 * @param config Configuration for the outstream player.
 */
export const prebidOutstreamRenderer = (
  domId: string,
  config: GenericConfiguration = {}
): prebidjs.IRenderer => ({
  url: 'https://assets.h5v.eu/prebid-outstream/3/bundle.js',
  render: bid => bid.renderer.push(() => window.outstreamPlayer?.(bid, domId, config)),
  backupOnly: true
});
