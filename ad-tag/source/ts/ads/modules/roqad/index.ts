/**
 * # [ROQAD](https://roq.ad/) Mapper
 *
 * Loads ROQAD's `mapper.js` once per page load after consent was given. All page data is passed
 * to ROQAD as query parameters on the script URL.
 *
 * ROQAD belongs to the zeotap family, but is a separate integration. Do not configure it through
 * the zeotap module.
 *
 * ## Integration
 *
 * In your `index.ts` import the module and register it.
 *
 * ```js
 * import { createRoqad } from '@highfivve/ad-tag/ads/modules/roqad';
 * moli.registerModule(createRoqad());
 * ```
 *
 * ## Configuration
 *
 * ```json
 * {
 *   "modules": {
 *     "roqad": {
 *       "enabled": true,
 *       "zdid": "1234",
 *       "publisherName": "example-publisher",
 *       "spaMode": false,
 *       "mappingDefinitions": [
 *         { "roqadValueType": "string", "key": "channel", "parameter": "category", "defaultValue": "none" },
 *         { "roqadValueType": "string", "key": "tags", "parameter": "interests" }
 *       ]
 *     }
 *   }
 * }
 * ```
 *
 * ### Fixed parameters
 *
 * | Parameter        | Value                                                                       |
 * | ---------------- | --------------------------------------------------------------------------- |
 * | `zdid`           | `zdid` from the module config                                               |
 * | `env`            | `mWeb` if the `mobile` label is active, `desktop` otherwise                 |
 * | `eventType`      | always `pageview`                                                           |
 * | `publisher_name` | `publisherName` from the module config                                      |
 * | `partner_dom`    | `window.location.hostname`                                                  |
 * | `z_e_sha2_l`     | `audience.hem.sha256BasicNormalized`, falls back to `audience.hem.sha256`.  |
 * |                  | Omitted if neither is set.                                                  |
 *
 * ### Parameter mappings
 *
 * Each entry in `mappingDefinitions` reads one key-value and sends it as one URL parameter.
 * Targeting key-values from the config and runtime key-values (`moli.setTargeting`) are merged,
 * runtime key-values win. Array values are sent comma-separated. If the value is missing, an empty
 * string or an empty array, the `defaultValue` is used, or the parameter is omitted.
 *
 * ### Consent
 *
 * If GDPR applies, vendor consent for ROQAD (4) and zeotap (301) and consent for purpose 1 are
 * required. Without GDPR the script is always loaded.
 *
 * ### Single page applications
 *
 * SPA syncs are not supported yet. With `spaMode: true` the script is loaded only once on the
 * first page view and a warning is logged.
 *
 * @module
 */
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { tcfapi } from 'ad-tag/types/tcfapi';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

const name = 'roqad';

const mapperUrl = 'https://zd.rqtrk.eu/mapper.js';

/**
 * IAB global vendor list ids that must have consent: Roq.ad (4) and zeotap (301)
 */
const requiredVendorIds = [4, 301] as const;

/**
 * A URL parameter name and its already URL-encoded value. `undefined` omits the parameter.
 */
type UrlParameter = readonly [name: string, encodedValue: string | undefined];

const hasRequiredConsent = (tcData: tcfapi.responses.TCData): boolean =>
  !tcData.gdprApplies ||
  (requiredVendorIds.every(vendorId => tcData.vendor.consents[vendorId]) &&
    !!tcData.purpose.consents[tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE]);

/**
 * Returns the URL-encoded value for a mapping, or `undefined` if the parameter should be omitted.
 */
const encodeMappedValue = (
  keyValues: googleAdManager.KeyValueMap,
  mapping: modules.roqad.RoqadParameterMapping
): string | undefined => {
  const value = keyValues[mapping.key];
  if (Array.isArray(value)) {
    if (value.length > 0) {
      return value.map(encodeURIComponent).join(',');
    }
  } else if (value) {
    return encodeURIComponent(value);
  }
  return mapping.defaultValue !== undefined ? encodeURIComponent(mapping.defaultValue) : undefined;
};

const buildMapperUrl = (
  config: modules.roqad.RoqadModuleConfig,
  context: AdPipelineContext
): string => {
  const hem = context.runtimeConfig__.audience?.hem;
  const hashedEmail = hem?.sha256BasicNormalized ?? hem?.sha256;
  const isMobile = context.labelConfigService__.getSupportedLabels().includes('mobile');

  const keyValues: googleAdManager.KeyValueMap = {
    ...context.config__.targeting?.keyValues,
    ...context.runtimeConfig__.keyValues
  };

  const fixedParameters: ReadonlyArray<UrlParameter> = [
    ['zdid', config.zdid],
    ['env', isMobile ? 'mWeb' : 'desktop'],
    ['eventType', 'pageview'],
    ['publisher_name', config.publisherName],
    ['partner_dom', context.window__.location.hostname],
    ['z_e_sha2_l', hashedEmail]
  ];

  const parameters: ReadonlyArray<UrlParameter> = [
    ...fixedParameters.map(([parameter, value]): UrlParameter => [
      parameter,
      value !== undefined ? encodeURIComponent(value) : undefined
    ]),
    ...config.mappingDefinitions.map((mapping): UrlParameter => [
      mapping.parameter,
      encodeMappedValue(keyValues, mapping)
    ])
  ];

  const query = parameters
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([parameter, value]) => `${encodeURIComponent(parameter)}=${value}`)
    .join('&');

  return `${mapperUrl}?${query}`;
};

/**
 * Creates the ROQAD Mapper module.
 *
 * @see modules.roqad.RoqadModuleConfig
 */
export const createRoqad = (): IModule => {
  let roqadConfig: modules.roqad.RoqadModuleConfig | null = null;
  let isLoaded = false;
  let hasWarnedAboutSpaMode = false;

  const loadMapper = (
    config: modules.roqad.RoqadModuleConfig,
    context: AdPipelineContext
  ): Promise<void> => {
    if (config.spaMode && !hasWarnedAboutSpaMode) {
      hasWarnedAboutSpaMode = true;
      context.logger__.warn(
        name,
        'SPA syncs are not supported yet. mapper.js is only loaded on the first page view.'
      );
    }

    if (isLoaded || !hasRequiredConsent(context.tcData__)) {
      return Promise.resolve();
    }
    isLoaded = true;

    context.assetLoaderService__
      .loadScript({
        name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: buildMapperUrl(config, context)
      })
      .catch(error => context.logger__.error(name, 'failed to load mapper.js', error));

    return Promise.resolve();
  };

  return {
    name,
    configKey: 'roqad',
    description: 'Loads the ROQAD mapper script with page data after consent was given',
    moduleType: 'dmp' as ModuleType,

    config__: (): modules.roqad.RoqadModuleConfig | null => roqadConfig,

    configure__(moduleConfig?: modules.ModulesConfig): void {
      if (moduleConfig?.roqad?.enabled) {
        roqadConfig = moduleConfig.roqad;
      }
    },

    initSteps__(): InitStep[] {
      const config = roqadConfig;
      return config ? [mkInitStep(name, context => loadMapper(config, context))] : [];
    },

    configureSteps__: (): ConfigureStep[] => [],

    prepareRequestAdsSteps__: (): PrepareRequestAdsStep[] => []
  };
};
