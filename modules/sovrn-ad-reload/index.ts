/**
 * # [Sovrn](https://www.sovrn.com/)
 *
 * Sovrn provides an Ad Reload solution to optimize long lived user sessions by reload
 * specific ad slots.
 *
 * ## Integration
 *
 * In your `index.ts` import SovrnAdReload and register the module.
 *
 * ```js
 * import { SovrnAdReload } from '@highfivve/module-sovrn-ad-reload';
 * moli.registerModule(new SovrnAdReload({
 *     assetUrl: '//get.s-onetag.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/tag.min.js'
 * }));
 * ```
 *
 * The property id (`xxx-xxxx....`) is part of an "Ad Tag". We create one for each publisher.
 *
 * ## Resources
 *
 * - [Sovrn documentation](https://www.sovrn.com/support/frequently-asked-questions-for-signal/)
 * - [Sovrn Ad Tag](https://meridian.sovrn.com/#adtags/connect_tags)
 * - [Confluence Page](https://confluence.gutefrage.net/display/DEV/Sovrn)
 *
 * @module
 */
import { Moli, IModule, ModuleType, IAssetLoaderService, AssetLoadMethod } from '@highfivve/ad-tag';

export type SovrnConfig = {
  /**
   * Points to the sovrn script.
   *
   * @example //get.s-onetag.com/ac0a9726-29d4-46f5-abf9-f3c3a9d699d7/tag.min.js
   */
  readonly assetUrl: string;
};

/**
 * # Sovrn Ad Reload
 *
 */
export class SovrnAdReload implements IModule {
  public readonly name: string = 'sovrn-ad-reload';
  public readonly description: string = 'ad reload';
  public readonly moduleType: ModuleType = 'ad-reload';

  constructor(private readonly sovrnConfig: SovrnConfig) {}

  config(): Object | null {
    return this.sovrnConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: this.sovrnConfig.assetUrl
    });
  }
}
