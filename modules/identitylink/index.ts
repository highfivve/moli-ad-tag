import { AssetLoadMethod, IAssetLoaderService, IModule, ModuleType, Moli } from '@highfivve/ad-tag';
import { ATS } from './types/identitylink';

type IdentityLinkModuleConfig = {
  /**
   * Points to the ATS script.
   *
   * @example //ats.rlcdn.com/ats.js
   */
  readonly assetUrl: string;

  /**
   * Provided by LiveRamp to identify your instance of ATS.
   */
  readonly pixelId: number;

  /**
   * Provided by LiveRamp to identify your instance of ATS.
   */
  readonly placementId: number;

  /**
   * md5, sha1, and sha256 hashes of the user's email address.
   */
  readonly hashedEmailAddresses: Array<string>;
};

/**
 * This module provides LiveRamp ATS (authenticated traffic solution) functionality to moli. Basically, this means that
 * users are identified cross-platform using a hash of their email address.
 *
 * @see: https://docs.authenticated-traffic-solution.com/docs/
 */
export default class IdentityLink implements IModule {
  public readonly name: string = 'identitylink';
  public readonly description: string =
    "Provides LiveRamp's ATS (authenticated traffic solution) functionality to Moli.";
  public readonly moduleType: ModuleType = 'identity';

  private readonly atsConfig: ATS.Config;
  private readonly window: ATS.Window;

  constructor(private readonly moduleConfig: IdentityLinkModuleConfig, window: Window) {
    this.window = window as ATS.Window;

    this.atsConfig = {
      placementID: moduleConfig.placementId,
      pixelID: moduleConfig.pixelId,
      storageType: 'localStorage',
      emailHashes: moduleConfig.hashedEmailAddresses,
      logging: 'error'
    };
  }

  config(): IdentityLinkModuleConfig {
    return this.moduleConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: this.moduleConfig.assetUrl
      })
      .then(() => this.window.ats.start(this.atsConfig));
  }
}
