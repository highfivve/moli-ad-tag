/**
 * # [Confiant](https://www.confiant.com/)
 *
 * Confiant is an ad fraud detection and blocking solution. It supports gpt and prebid.
 *
 * ## Integration
 *
 * In your `index.ts` import confiant and register the module.
 *
 * ```js
 * import { Confiant } from '@highfivve/module-confiant';
 * moli.registerModule(new Confiant({
 *   assertUrl: 'https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js'
 * }, window));
 * ```
 *
 * ### Alternative integration
 *
 * A publisher can also decided to integrated it directly in the head with
 *
 * ```html
 * <head>
 *     <script async src="https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js"></script>
 * </head>
 * ```
 *
 * ## Resources
 *
 * - [Confiant Dashboard](https://app.confiant.com/)

 * @module
 */
import { Moli, IModule, ModuleType, AssetLoadMethod, IAssetLoaderService } from '@highfivve/ad-tag';

export type ConfiantConfig = {
  /**
   * Conviant loads a single javascript file that contains all the configuration properties
   */
  readonly assetUrl: string;
};

/**
 * ## Confiant Ad Fraud Protection
 *
 * Confiant blocks malicious ads.
 *
 */
export class Confiant implements IModule {
  public readonly name: string = 'confiant';
  public readonly description: string = 'ad fraud detection and protection module';
  public readonly moduleType: ModuleType = 'ad-fraud';

  constructor(private readonly confiantConfig: ConfiantConfig, private readonly window: Window) {}

  config(): Object | null {
    return this.confiantConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    assetLoaderService.loadScript({
      name: 'confiant',
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: this.confiantConfig.assetUrl
    });
  }
}
