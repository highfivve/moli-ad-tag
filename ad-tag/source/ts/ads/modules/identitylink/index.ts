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
import { IModule, ModuleType } from 'ad-tag/types/module';
import { ATS } from 'ad-tag/types/identitylink';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod, IAssetLoaderService } from 'ad-tag/util/assetLoaderService';

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

  private readonly gvlid: string = '97';

  private identityLinkConfig: modules.identitylink.IdentityLinkModuleConfig | null = null;

  constructor() {}

  config(): modules.identitylink.IdentityLinkModuleConfig | null {
    return this.identityLinkConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.identitylink && moduleConfig.identitylink.enabled) {
      this.identityLinkConfig = moduleConfig.identitylink;
    }
  }

  initSteps(assetLoaderService: IAssetLoaderService): InitStep[] {
    const config = this.identityLinkConfig;
    return config
      ? [
          mkInitStep(this.name, ctx => {
            // async loading - prebid takes care of auction delay
            this.loadAts(ctx, assetLoaderService, config);
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }

  loadAts(
    context: AdPipelineContext,
    assetLoaderService: IAssetLoaderService,
    moduleConfig: modules.identitylink.IdentityLinkModuleConfig
  ): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }

    const window = context.window as unknown as ATS.ATSWindow;
    // register event lister for email module
    // see https://docs.liveramp.com/privacy-manager/en/ats-js-functions-and-events.html#envelopemoduleready
    window.addEventListener('envelopeModuleReady', () => {
      // For example, you can directly feed it emails, like so:
      window.atsenvelopemodule.setAdditionalData({
        type: 'emailHashes',
        id: moduleConfig.hashedEmailAddresses
      });
    });

    return assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://launchpad-wrapper.privacymanager.io/${moduleConfig.launchPadId}/launchpad-liveramp.js`
      })
      .catch(error => context.logger.error('failed to load emetriq', error));
  }
}
