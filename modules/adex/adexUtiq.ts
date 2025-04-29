import { AdexModuleConfig, ITheAdexWindow } from './index';
import type { UtiqWindow } from '../utiq';

/**
 * Enables Utiq ID tracking for Adex.
 *
 * @see https://docs.utiq.com/docs/cdp-integration
 */
export const trackUtiqId = (
  config: AdexModuleConfig,
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
