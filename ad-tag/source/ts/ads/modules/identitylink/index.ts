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
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

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

  config__(): modules.identitylink.IdentityLinkModuleConfig | null {
    return this.identityLinkConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.identitylink && moduleConfig.identitylink.enabled) {
      this.identityLinkConfig = moduleConfig.identitylink;
    }
  }

  initSteps__(): InitStep[] {
    const config = this.identityLinkConfig;
    return config
      ? [
          mkInitStep(this.name, ctx => {
            // async loading - prebid takes care of auction delay
            this.loadAts(ctx, config);
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps__(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }

  loadAts(
    context: AdPipelineContext,
    moduleConfig: modules.identitylink.IdentityLinkModuleConfig
  ): Promise<void> {
    // test environment doesn't require confiant
    if (context.env__ === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData__.gdprApplies && !context.tcData__.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }

    const window = context.window__ as unknown as ATS.ATSWindow;
    // register event lister for email module
    // see https://docs.liveramp.com/privacy-manager/en/ats-js-functions-and-events.html#envelopemoduleready
    window.addEventListener('envelopeModuleReady', () => {
      const hashedEmailAddresses: string[] = [...moduleConfig.hashedEmailAddresses];
      const sha1 = context.runtimeConfig__.audience?.hem?.sha1;
      const sha256 = context.runtimeConfig__.audience?.hem?.sha256;
      const md5 = context.runtimeConfig__.audience?.hem?.md5;

      /** ordering is important for LiveRamp: [SHA-1, SHA-256, MD5] */
      if (sha1 !== undefined) {
        hashedEmailAddresses[0] = sha1;
      }
      if (sha256 !== undefined) {
        hashedEmailAddresses[1] = sha256;
      }
      if (md5 !== undefined) {
        hashedEmailAddresses[2] = md5;
      }

      // For example, you can directly feed it emails, like so:
      window.atsenvelopemodule.setAdditionalData({
        type: 'emailHashes',
        id: hashedEmailAddresses
      });
    });

    return context.assetLoaderService__
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://launchpad-wrapper.privacymanager.io/${moduleConfig.launchPadId}/launchpad-liveramp.js`
      })
      .catch(error => context.logger__.error('failed to load emetriq', error));
  }
}
