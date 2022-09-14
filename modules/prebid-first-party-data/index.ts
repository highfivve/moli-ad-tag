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
  getLogger,
  IAssetLoaderService,
  IModule,
  mergeDeep,
  mkConfigureStep,
  ModuleType,
  Moli,
  prebidjs,
  uniquePrimitiveFilter
} from '@highfivve/ad-tag';
import PrebidFirstPartyData = prebidjs.firstpartydata.PrebidFirstPartyData;
import OpenRtb2Site = prebidjs.firstpartydata.OpenRtb2Site;
import OpenRtb2Data = prebidjs.firstpartydata.OpenRtb2Data;

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
   * The `key` in the targeting map that contains the `pageCat` values.
   *
   * The targeting values should be an array of IAB content categories that describe the current page or view of
   * the site. if not defined, `cat` will be used as a fallback
   */
  readonly pageCat?: string;

  /**
   * The `key` in the targeting map that contains the `iabV2` segment values.
   *
   * The targeting values should be an array of IABV2 content category ids that describe the current page or view of
   * the site. if not defined, we'll not set the data object.
   */
  readonly iabV2?: string;

  /**
   * The `key` in the targeting map that contains the `iabV3` segment values.
   *
   * The targeting values should be an array of IABV3 content category ids that describe the current page or view of
   * the site. if not defined, we'll not set the data object.
   */
  readonly iabV3?: string;
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

  /**
   * Name of the provider that is used in the site.content.data segments as provider name.
   * Usually, this is the name/domain of the publisher.
   *
   * https://docs.prebid.org/features/firstPartyData.html#segments-and-taxonomy
   */
  readonly iabDataProviderName?: string;
};

export class PrebidFirstPartyDataModule implements IModule {
  readonly description = 'Module for passing first party data to prebid auctions';
  readonly moduleType: ModuleType = 'prebid';
  readonly name = 'prebid-first-party-data';

  private log?: Moli.MoliLogger;

  constructor(
    private readonly moduleConfig: PrebidFirstPartyDataModuleConfig,
    private readonly window: Window
  ) {}

  config(): PrebidFirstPartyDataModuleConfig {
    return this.moduleConfig;
  }

  init(
    moliConfig: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ): void {
    const log = getLogger(moliConfig, this.window);
    this.log = log;

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    moliConfig.pipeline.configureSteps.push(
      mkConfigureStep('prebid-fpd-module-configure', context =>
        PrebidFirstPartyDataModule.setPrebidFpdConfig(context, this.config(), log)
      )
    );
  }

  private static setPrebidFpdConfig(
    context: AdPipelineContext,
    config: PrebidFirstPartyDataModuleConfig,
    log: Moli.MoliLogger
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

        if (!config.iabDataProviderName && (gptTargeting.iabV2 || gptTargeting.iabV3)) {
          log.error(
            'PrebidFirstPartyDataModule',
            'Targeting for iabV2 or iabV3 was defined, but iabDataProviderName was not configured. Data Segments will not be set.'
          );
        }

        // Set site.content.data objects with the publisher as data provider and the iab v2 segments for this page.
        if (gptTargeting.iabV2 && config.iabDataProviderName) {
          const iabV2Ids = PrebidFirstPartyDataModule.extractKeyValueArray(
            gptTargeting.iabV2,
            keyValues
          );

          const publisherContentData: OpenRtb2Data = {
            name: config.iabDataProviderName,
            ext: {
              segtax: 6 // Segtax version for IAB Tech Lab Content Taxonomy 2.2
            },
            segment: iabV2Ids.map(iabV2Id => ({ id: iabV2Id })).filter(uniquePrimitiveFilter)
          };

          site.content = {
            ...site.content,
            data: [...(site.content?.data ?? []), publisherContentData].filter(
              uniquePrimitiveFilter
            )
          };
        }

        // Set site.content.data objects with the publisher as data provider and the iab v3 segments for this page.
        if (gptTargeting.iabV3 && config.iabDataProviderName) {
          const iabV3Ids = PrebidFirstPartyDataModule.extractKeyValueArray(
            gptTargeting.iabV3,
            keyValues
          );

          const publisherContentData: OpenRtb2Data = {
            name: config.iabDataProviderName,
            ext: {
              segtax: 7 // Segtax version for IAB Tech Lab Content Taxonomy 3
            },
            segment: iabV3Ids.map(iabV3Id => ({ id: iabV3Id })).filter(uniquePrimitiveFilter)
          };

          site.content = {
            ...site.content,
            data: [...(site.content?.data ?? []), publisherContentData].filter(
              uniquePrimitiveFilter
            )
          };
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

      // make site objects unique
      if (ortb2.site) {
        if (ortb2.site.cat) {
          ortb2.site.cat = ortb2.site.cat.filter(uniquePrimitiveFilter);
        }
        if (ortb2.site.sectioncat) {
          ortb2.site.sectioncat = ortb2.site.sectioncat.filter(uniquePrimitiveFilter);
        }
        if (ortb2.site.pagecat) {
          ortb2.site.pagecat = ortb2.site.pagecat.filter(uniquePrimitiveFilter);
        }
      }

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
