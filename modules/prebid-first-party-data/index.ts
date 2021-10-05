/**
 * # Prebid First Party Data Module
 *
 * The main purpose of this module is to provide a consistent API for publishers that don't want to interact with `pbjs`
 * directly. This module
 *
 * - supports a static configuration that is built into the ad tag. Useful for static properties like `site.cat`,
 *   `site.mobile` or `site.privacypolicy`
 * - supports a limited mapping definition from key-values available via `moli.setTargeting`. This allows to reuse the
 *   IAB categories
 *
 * ## Integration
 *
 * In your `index.ts` import the prebid-fpd-module module and register it.
 *
 * ```javascript
 * import { PrebidFpd } from '@highfivve/module-prebid-first-party-data'
 *
 * moli.registerModule(new PrebidFpd({
 *    staticPrebidFirstPartyData: { },
 *    gptTargetingMappings: {
 *      cat: 'openrtb2_page_cat'
 *    }
 * }));
 * ```
 *
 * The `gptTargetingMappings` property is optional. For static IAB categories you can also use the
 * `staticPrebidFirstPartyData` object.
 *
 * ## Prebid.js _First Party Data Enrichment Module_
 *
 * [The First Party Data Enrichment Module](https://docs.prebid.org/dev-docs/modules/enrichmentFpdModule.html] already
 * extracts some generic values directly from the side and should always be included alongside this module.
 *
 * @see https://docs.prebid.org/features/firstPartyData.html
 * @see https://docs.prebid.org/dev-docs/modules/enrichmentFpdModule.html
 *
 * @module
 */
import {
  AdPipeline,
  AdPipelineContext,
  IAssetLoaderService,
  IModule,
  mergeDeep,
  mkConfigureStep,
  ModuleType,
  Moli,
  prebidjs
} from '@highfivve/ad-tag';
import PrebidFirstPartyData = prebidjs.firstpartydata.PrebidFirstPartyData;
import OpenRtb2Site = prebidjs.firstpartydata.OpenRtb2Site;

export type GptTargetingMapping = {
  /**
   * The `key` in the targeting map that contains the `cat` values.
   *
   * The targeting values should be an array of IAB content categories of the site.
   */
  readonly cat?: string;

  /**
   * The `key` in the targeting map that contains the `sectionCat` values.
   *
   * The targeting values should be an array of IAB content categories that describe the current section of the site.
   * If not defined, `cat` will be used as a fallback
   */
  readonly sectionCat?: string;

  /**
   * The `key` in the targeting map that contains the `sectionCat` values.
   *
   * The targeting values should be an array of IAB content categories that describe the current page or view of
   * the site. if not defined, `cat` will be used as a fallback
   */
  readonly pageCat?: string;
};

export type PrebidFirstPartyDataModuleConfig = {
  /**
   * A static OpenRTB2 config that is merged with the dynamic settings from
   * the key value targetings
   */
  readonly staticPrebidFirstPartyData?: PrebidFirstPartyData;

  /**
   * static mapping definitions for relevant OpenRTB 2.5 properties from
   * gpt targetings.
   *
   * Use this to extract dynamic values set via `moli.setTargeting()`.
   */
  readonly gptTargetingMappings?: GptTargetingMapping;
};

export class PrebidFirstPartyDataModule implements IModule {
  readonly description = 'Module for passing first party data to prebid auctions';
  readonly moduleType: ModuleType = 'prebid';
  readonly name = 'prebid-first-party-data';

  constructor(private readonly moduleConfig: PrebidFirstPartyDataModuleConfig) {}

  config(): PrebidFirstPartyDataModuleConfig {
    return this.moduleConfig;
  }

  init(
    moliConfig: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ): void {
    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    moliConfig.pipeline.configureSteps.push(
      mkConfigureStep('prebid-fpd-module-configure', context =>
        PrebidFirstPartyDataModule.setPrebidFpdConfig(context, this.config())
      )
    );
  }

  private static setPrebidFpdConfig(
    context: AdPipelineContext,
    config: PrebidFirstPartyDataModuleConfig
  ): Promise<void> {
    if (context.config.prebid) {
      const keyValues = context.config.targeting?.keyValues || {};
      const gptTargeting = config.gptTargetingMappings;

      const existingFpd = context.window.pbjs.getConfig().ortb2 || {};
      // extract key-values from gpt targeting
      const ortb2FromKeyValues: PrebidFirstPartyData = {};
      if (gptTargeting) {
        const site: OpenRtb2Site = {};
        if (gptTargeting.cat) {
          site.cat = PrebidFirstPartyDataModule.extractKeyValueArray(gptTargeting.cat, keyValues);
          site.pagecat = site.cat;
          site.sectioncat = site.cat;
        }
        if (gptTargeting.sectionCat) {
          site.sectioncat = PrebidFirstPartyDataModule.extractKeyValueArray(
            gptTargeting.sectionCat,
            keyValues
          );
        }
        if (gptTargeting.pageCat) {
          site.pagecat = PrebidFirstPartyDataModule.extractKeyValueArray(
            gptTargeting.pageCat,
            keyValues
          );
        }
        ortb2FromKeyValues.site = site;
      }

      // preserve preexisting ortb2 data (e.g. from the fpd enrichment module)
      const ortb2 = mergeDeep(
        {},
        config.staticPrebidFirstPartyData,
        ortb2FromKeyValues,
        existingFpd
      ) as PrebidFirstPartyData;
      context.window.pbjs.setConfig({ ortb2 });
    }

    return Promise.resolve();
  }

  private static extractKeyValueArray(key: string, keyValues: Moli.DfpKeyValueMap): string[] {
    const value = keyValues[key];
    if (value) {
      return typeof value === 'string' ? [value] : value;
    } else {
      return [];
    }
  }
}
