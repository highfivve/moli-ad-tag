import { ITheAdexWindow } from './index';
import { UtiqWindow } from '../utiq';
import { modules } from 'ad-tag/types/moliConfig';

/**
 * Enables Utiq ID tracking for Adex.
 *
 * @see https://docs.utiq.com/docs/cdp-integration
 */
export const trackUtiqId = (
  config: modules.adex.AdexConfig,
  window__: ITheAdexWindow & UtiqWindow
): void => {
  window__.Utiq ||= { queue: [] };
  window__.Utiq.queue ||= [];

  window__.Utiq.queue.push(() => {
    window__.Utiq?.API?.addEventListener('onIdsAvailable', ({ mtid }) => {
      // Callback action for onIdsAvailable
      window__._adexc.push([
        `/${config.adexCustomerId}/${config.adexTagId}/`,
        'cm',
        '_cm',
        [308, mtid] // '308' is Utiq's partner ID
      ]);
    });
  });
};
