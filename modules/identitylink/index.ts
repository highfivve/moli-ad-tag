/**
 * # LiveRamp IdentityLink module ([-> Docs](https://developers.liveramp.com/authenticatedtraffic-api/docs/atsjs-quickstart-guide))
 *
 * This module provides LiveRamp ATS (authenticated traffic solution) functionality to moli. Basically,
 * this means that users are identified cross-platform using a hash of their email address.
 *
 * ## Integration
 *
 * In your `index.ts`, import IdentityLink and register the module.
 *
 * ```js
 * import { IdentityLink } from '@highfivve/module-identitylink';
 *
 * moli.registerModule(
 *   new IdentityLink({
 *     assetUrl: '//ats.rlcdn.com/ats.js',
 *     placementId: 1337,
 *     hashedEmailAddresses: ['[MD5 hash]', '[SHA-1 hash]', '[SHA-256 hash]']
 *   })
 * );
 * ```
 *
 * Configure the module with:
 *
 * - the `ats.js` URL (can be protocol relative)
 * - your LiveRamp placement id
 * - pre-hashed versions of the user's email address (MD5, SHA-1, and SHA-256 format)
 *
 * @module
 */
import {
  AdPipelineContext,
  AssetLoadMethod,
  IAssetLoaderService,
  IModule,
  mkInitStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';
import { ATS } from './types/identitylink';

export type IdentityLinkModuleConfig = {
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
 * # IdentityLink Module
 *
 * This module provides LiveRamp ATS (authenticated traffic solution) functionality to moli. Basically, this means that
 * users are identified cross-platform using a hash of their email address.
 *
 * @see https://developers.liveramp.com/authenticatedtraffic-api/docs/atsjs-quickstart-guide
 */
export class IdentityLink implements IModule {
  public readonly name: string = 'identitylink';
  public readonly description: string =
    "Provides LiveRamp's ATS (authenticated traffic solution) functionality to Moli.";
  public readonly moduleType: ModuleType = 'identity';

  private readonly atsConfig: ATS.Config;
  private readonly window: ATS.ATSWindow;

  constructor(private readonly moduleConfig: IdentityLinkModuleConfig, window: Window) {
    this.window = window as ATS.ATSWindow;

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
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => {
        // async loading - prebid takes care of auction delay
        this.loadAts(ctx, assetLoaderService);
        return Promise.resolve();
      })
    );
  }

  loadAts(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents['97']) {
      return Promise.resolve();
    }
    return assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: this.moduleConfig.assetUrl
      })
      .then(() => this.window.ats.start(this.atsConfig));
  }
}
