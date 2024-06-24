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
import { prebidjs } from 'ad-tag/types/prebidjs';
import PrebidFirstPartyData = prebidjs.firstpartydata.PrebidFirstPartyData;
import OpenRtb2Site = prebidjs.firstpartydata.OpenRtb2Site;
import OpenRtb2Data = prebidjs.firstpartydata.OpenRtb2Data;
import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { GoogleAdManagerKeyValueMap, modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { uniquePrimitiveFilter } from 'ad-tag/util/arrayUtils';
import { mergeDeep } from 'ad-tag/util/objectUtils';

export class PrebidFirstPartyDataModule implements IModule {
  readonly description = 'Module for passing first party data to prebid auctions';
  readonly moduleType: ModuleType = 'prebid';
  readonly name = 'prebid-first-party-data';

  private moduleConfig: modules.prebid_first_party_data.PrebidFirstPartyDataModuleConfig | null =
    null;
  private _configureSteps: ConfigureStep[] = [];

  config(): modules.prebid_first_party_data.PrebidFirstPartyDataModuleConfig | null {
    return this.moduleConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.prebidFirstPartyData?.enabled) {
      const config = moduleConfig.prebidFirstPartyData;
      this._configureSteps = [
        mkConfigureStep('prebid-fpd-module-configure', context =>
          PrebidFirstPartyDataModule.setPrebidFpdConfig(context, config, context.logger)
        )
      ];
    }
  }

  initSteps(assetLoaderService: IAssetLoaderService): InitStep[] {
    return [];
  }

  configureSteps(): ConfigureStep[] {
    return this._configureSteps;
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }

  private static setPrebidFpdConfig(
    context: AdPipelineContext,
    config: modules.prebid_first_party_data.PrebidFirstPartyDataModuleConfig,
    log: MoliRuntime.MoliLogger
  ): Promise<void> {
    if (context.config.prebid) {
      const keyValues = context.config.targeting?.keyValues || {};
      const gptTargeting = config.gptTargetingMappings;

      const existingFpd = context.window.pbjs.readConfig().ortb2 || {};

      // extract key-values from gpt targeting
      const ortb2FromKeyValues = mergeDeep({}, config.staticPrebidFirstPartyData, existingFpd);
      if (gptTargeting) {
        const site: OpenRtb2Site = {
          cat: [],
          sectioncat: [],
          pagecat: [],
          ...ortb2FromKeyValues.site
        };
        if (gptTargeting.cat) {
          const keyValueData = PrebidFirstPartyDataModule.extractKeyValueArray(
            gptTargeting.cat,
            keyValues
          );
          site.cat?.push(...keyValueData);
          site.pagecat?.push(...keyValueData);
          site.sectioncat?.push(...keyValueData);
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

        if (site.cat) {
          site.cat = site.cat.filter(uniquePrimitiveFilter);
        }

        if (site.sectioncat) {
          site.sectioncat = site.sectioncat.filter(uniquePrimitiveFilter);
        }

        if (site.pagecat) {
          site.pagecat = site.pagecat.filter(uniquePrimitiveFilter);
        }

        if (!config.iabDataProviderName && (gptTargeting.iabV2 || gptTargeting.iabV3)) {
          log.error(
            'PrebidFirstPartyDataModule',
            'Targeting for iabV2 or iabV3 was defined, but iabDataProviderName was not configured. Data Segments will not be set.'
          );
        }

        // Clear all data objects with the same name as the configured iabDataProviderName as we'll add them again anyway.
        // This prevents duplicated entries in the site.content.data array.
        site.content = {
          ...site.content,
          data: site.content?.data?.filter(data => data.name !== config.iabDataProviderName) ?? []
        };

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

          site.content.data?.push(publisherContentData);
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

          site.content.data?.push(publisherContentData);
        }

        ortb2FromKeyValues.site = site;
      }

      context.window.pbjs.setConfig({ ortb2: ortb2FromKeyValues });
    }

    return Promise.resolve();
  }

  private static extractKeyValueArray(
    key: string,
    keyValues: GoogleAdManagerKeyValueMap
  ): string[] {
    const value = keyValues[key];
    if (value) {
      return typeof value === 'string' ? [value] : value;
    } else {
      return [];
    }
  }
}
