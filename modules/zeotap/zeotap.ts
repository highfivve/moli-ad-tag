import {
  AssetLoadMethod,
  getLogger,
  IAssetLoaderService,
  IModule,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

type ZeotapModuleConfig = {
  /**
   * Points to the zeotap script, containing only env, eventType and zdid parameters. The other parameters (country
   * code, idp, tier1Category, tier2Category, tags, hashed email address) are added through configuration parameters.
   *
   * @example //spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337
   */
  readonly assetUrl: string;

  /**
   * Alpha-ISO3 country code, e.g. "DEU"
   */
  readonly countryCode: string;

  /**
   * Whether zeotap's id plus module (user id module) is active or not. Note that in order to use the id+ module, you
   * have to provide a sha-256 hashed email address as well.
   */
  readonly idpActive: boolean;

  /**
   * sha-256 hash of the user's email address.
   */
  readonly hashedEmailAddress?: string;

  /**
   * The mode defines if the zeotap script can be loaded repeatedly with updated parameters (in spa/single page
   * application mode) or just once (for sever side rendered pages, mode = default).
   */
  readonly mode: 'spa' | 'default';
};

/**
 * This module provides Zeotap's data collection and identity plus (id+/idp) functionality to moli.
 *
 * @see: https://zeotap.com/
 */
export default class Zeotap implements IModule {
  public readonly name: string = 'zeotap';
  public readonly description: string =
    'Provides Zeotap functionality (data collection and identity plus) to Moli.';
  public readonly moduleType: ModuleType = 'identity';

  private readonly window: Window;
  private assetLoaderService: IAssetLoaderService | undefined;
  private logger: Moli.MoliLogger | undefined;

  /**
   * Keeps track of how often the script was loaded. Used to prevent reloading the script in default mode.
   */
  private loadScriptCount: number = 0;

  /**
   * Cache for idpActive/hashedEmailAddress truthiness.
   */
  private idPlusEnabled: boolean = false;

  constructor(private readonly moduleConfig: ZeotapModuleConfig, window: Window) {
    this.window = window;
  }

  config(): ZeotapModuleConfig {
    return this.moduleConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    this.assetLoaderService = assetLoaderService;
    this.logger = getLogger(config, this.window);

    if (!this.moduleConfig.hashedEmailAddress && this.moduleConfig.idpActive) {
      this.logger.warn(
        'Zeotap module :: potential misconfiguration: idpActive is true, but no hash given.'
      );
    }

    this.idPlusEnabled = this.moduleConfig.idpActive && !!this.moduleConfig.hashedEmailAddress;
  }

  /**
   * Let the asset loader load the script (again).
   *
   * @param tier1Category IAB tier 1 category of the current page.
   * @param tier2Category IAB tier 2 category of the current page.
   * @param tags Tags/keywords of the current page.
   */
  loadScript = (
    tier1Category: string,
    tier2Category: string,
    tags: Array<string>
  ): Promise<void> => {
    if (!this.assetLoaderService) {
      return Promise.reject('Zeotap module :: no asset loader found, module not initialized yet?');
    }

    if (this.moduleConfig.mode === 'default' && this.loadScriptCount > 0) {
      return Promise.reject("Zeotap module :: can't reload script in default mode.");
    }

    const assetUrl =
      this.moduleConfig.assetUrl +
      `&ctry=${this.moduleConfig.countryCode}` +
      `&idp=${!!this.moduleConfig.hashedEmailAddress && this.moduleConfig.idpActive ? 1 : 0}` +
      `&zcat=${encodeURIComponent(tier1Category)}` +
      `&zscat=${encodeURIComponent(tier2Category)}` +
      `&zcid=${encodeURIComponent(tags.join(','))}` +
      (this.idPlusEnabled ? `&z_e_sha2_l=${this.moduleConfig.hashedEmailAddress}` : '');

    this.loadScriptCount++;

    return this.assetLoaderService?.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl
    });
  };
}
