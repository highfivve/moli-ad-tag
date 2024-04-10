/**
 * # Cleanup Module
 *
 * Cleans up special formats if enabled (on user navigation and ad reload), especially useful for SPAs.
 *
 * The configs can either provide CSS selectors of the html elements that are part of the special/out-of-page formats and should be deleted
 * or JS as a string that will be evaluated by the module in order to remove these elements.
 *
 * ## Integration
 *
 * In your `index.ts` import the Cleanup module and register the module.
 *
 * ```js
 * moli.registerModule(new CleanupModule({
 *     enabled: true,
 *     configs: [
 *       {
 *         bidder: 'Seedtag',
 *         domId: 'manual-adslot',
 *         deleteMethod: {
 *           cssSelectors: ['.seedtag-container']
 *         }
 *       },
 *       {
 *         bidder: 'Seedtag',
 *         domId: 'lazy-loading-adslot-1',
 *         deleteMethod: {
 *           jsAsString: `window.document.querySelectorAll('.seedtag-containerr').forEach(element => element.remove());`
 *         }
 *       }
 *     }]));
 * ```
 *
 */

import { IModule, ModuleType, Moli } from '@highfivve/ad-tag';
import {
  destroyAllOutOfPageAdFormats,
  destroySpecialFormatOfReloadedSlot
} from '@highfivve/ad-tag/lib/ads/modules/cleanup';

export class Cleanup implements IModule {
  public readonly name: string = 'cleanup';
  public readonly description: string = 'cleanup out-of-page formats on navigation or ad-reload';
  public readonly moduleType: ModuleType = 'creatives';

  constructor(private readonly cleanupModuleConfig: Moli.modules.CleanupModuleConfig) {}

  config(): Object | null {
    return this.cleanupModuleConfig;
  }

  init(config: Moli.MoliConfig) {
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.configureSteps.push(destroyAllOutOfPageAdFormats(this.cleanupModuleConfig));
    config.pipeline.prepareRequestAdsSteps.push(
      destroySpecialFormatOfReloadedSlot(this.cleanupModuleConfig)
    );
  }
}
