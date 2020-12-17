import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { IModule, ModuleType } from '@highfivve/ad-tag/source/ts/types/module';
import {
  AssetLoadMethod,
  IAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

export interface ISovrnConfig {
  /**
   * Points to the sovrn script.
   *
   * @example //get.s-onetag.com/ac0a9726-29d4-46f5-abf9-f3c3a9d699d7/tag.min.js
   */
  readonly assetUrl: string;
}

/**
 * We use sovrn to reload ads every 20 seconds,
 * if the user is active on the page and the ad is in the user's viewport
 *
 * Sovrn has API-access (readonly) to our admanager, so that they can exclude ads
 * based on order id, line item type or placement id from reloading.
 *
 * In the second dfp request ads call, sovrn is sending a key-value `sovrn-reload = true`,
 * so that we can also exclude ads from being requested in the second round
 * or to make reports in dfp.
 *
 * @see We can configure the sovrn script here @link {https://meridian.sovrn.com/#adtags/connect_tags}
 * @see The sovrn documentation is here @link {https://www.sovrn.com/support/frequently-asked-questions-for-signal/}
 */
export default class SovrnAdReload implements IModule {
  public readonly name: string = 'sovrn-ad-reload';
  public readonly description: string = 'ad reload';
  public readonly moduleType: ModuleType = 'ad-reload';

  constructor(private readonly sovrnConfig: ISovrnConfig) {}

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
