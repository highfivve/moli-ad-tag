import { Moli, IModule, ModuleType, IAssetLoaderService, AssetLoadMethod } from '@highfivve/ad-tag';

export interface IConfiantConfig {

  /**
   * Conviant loads a single javascript file that contains all the configuration properties
   */
  readonly assetUrl: string;
}


/**
 * == Confiant Ad Fraud Protection ==
 *
 * Confiant blocks malicious ads.
 *
 */
export default class Confiant implements IModule {

  public readonly name: string = 'confiant';
  public readonly description: string = 'ad fraud detection and protection module';
  public readonly moduleType: ModuleType = 'ad-fraud';

  constructor(private readonly confiantConfig: IConfiantConfig, private readonly window: Window) {  }

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
