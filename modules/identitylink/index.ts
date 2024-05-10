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
  MoliRuntime
} from '@highfivve/ad-tag';
import { ATS } from './types/identitylink';

export type IdentityLinkModuleConfig = {
  /**
   * The launchPadID references a bunch of services from LiveRamp that are
   * loaded dynamically.
   *
   * It is used to load the script from the LiveRamp CDN at https://launchpad-wrapper.privacymanager.io
   *
   * @example `f865e2a1-5e8f-4011-ae31-079cbb0b1d8e`
   * @see https://launch.liveramp.com/launchpad/[launchPadId]
   * @see https://launchpad-wrapper.privacymanager.io/[launchPadId]/launchpad-liveramp.js
   */
  readonly launchPadId: string;

  /**
   * md5, sha1, and sha256 hashes of the user's email address.
   *
   * From the docs
   *
   * > While the ATS script only needs one hash to create the envelope, we highly recommend providing the ATS Library with
   * > all three email hash types to get the best match rate. If you are only able to provide one hash, use SHA256 for
   * > EU/EAA and SHA1 for U.S.
   *
   * Ordering seems important.
   *
   * - "EMAIL_HASH_SHA1",
   * - "EMAIL_HASH_SHA256",
   * - "EMAIL_HASH_MD5"
   */
  readonly hashedEmailAddresses: string[];
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

  private readonly window: ATS.ATSWindow;

  private readonly gvlid: string = '97';

  constructor(private readonly moduleConfig: IdentityLinkModuleConfig, window: Window) {
    this.window = window as ATS.ATSWindow;
  }

  config(): IdentityLinkModuleConfig {
    return this.moduleConfig;
  }

  init(config: MoliRuntime.MoliConfig, assetLoaderService: IAssetLoaderService): void {
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
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }

    // register event lister for email module
    // see https://docs.liveramp.com/privacy-manager/en/ats-js-functions-and-events.html#envelopemoduleready
    this.window.addEventListener('envelopeModuleReady', () => {
      // For example, you can directly feed it emails, like so:
      this.window.atsenvelopemodule.setAdditionalData({
        type: 'emailHashes',
        id: this.moduleConfig.hashedEmailAddresses
      });
    });

    return assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://launchpad-wrapper.privacymanager.io/${this.moduleConfig.launchPadId}/launchpad-liveramp.js`
      })
      .catch(error => context.logger.error('failed to load emetriq', error));
  }
}
