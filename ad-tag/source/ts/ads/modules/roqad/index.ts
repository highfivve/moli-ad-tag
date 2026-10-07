/**
 * # [ROQAD](https://roq.ad/) Cookie Sync
 *
 * Performs the ROQAD Cookie Sync once per `requestAds()` cycle after consent was given. All page
 * data is passed to ROQAD as query parameters on the sync URL.
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
 *       "syncMethod": "pixel",
 *       "mappingDefinitions": [
 *         { "roqadValueType": "string", "key": "channel", "parameter": "category", "defaultValue": "none" },
 *         { "roqadValueType": "string", "key": "tags", "parameter": "interests" }
 *       ]
 *     }
 *   }
 * }
 * ```
 *
 * ### Sync methods
 *
 * | `syncMethod`       | How                                                                          |
 * | ------------------ | ---------------------------------------------------------------------------- |
 * | `mapper` (default) | Loads `https://zd.rqtrk.eu/mapper.js` as a script tag. The script reads the  |
 * |                    | TCF consent from the CMP itself.                                             |
 * | `pixel`            | Loads `https://zd.rqtrk.eu/` in a hidden iframe (`#h5v-roqad-sync`) and      |
 * |                    | passes the TCF consent as URL parameters.                                    |
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
 * The `pixel` sync method additionally sends the consent parameters
 *
 * | Parameter      | Value                                                                         |
 * | -------------- | ----------------------------------------------------------------------------- |
 * | `cmp`          | always `1`                                                                    |
 * | `gdpr`         | `1` if GDPR applies, `0` if it does not apply. Omitted if unknown.            |
 * | `gdpr_consent` | the TCF consent string. Omitted if empty.                                     |
 * | `uc`           | always `1_2`                                                                  |
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
 * required. Without GDPR the sync always runs. This applies to both sync methods.
 *
 * ### Single page applications
 *
 * The sync runs once per `requestAds()` cycle, i.e. once per page load and once per virtual page
 * view in a single page application. Lazy loading and slot refreshes do not trigger a sync.
 *
 * Use `syncMethod: 'pixel'` for single page applications. The previous iframe is removed before
 * each sync, so there is always at most one. With `mapper` every sync leaves a script tag and a
 * `<div>` added by ROQAD in the page.
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
  mkConfigureStepOncePerRequestAdsCycle,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

const name = 'roqad';

const mapperUrl = 'https://zd.rqtrk.eu/mapper.js';

const pixelUrl = 'https://zd.rqtrk.eu/';

const syncIframeId = 'h5v-roqad-sync';

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

/**
 * The fixed parameters and the parameter mappings, already URL-encoded. Shared by both sync
 * methods.
 */
const buildPageParameters = (
  config: modules.roqad.RoqadModuleConfig,
  context: AdPipelineContext
): ReadonlyArray<UrlParameter> => {
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

  return [
    ...fixedParameters.map(([parameter, value]): UrlParameter => [
      parameter,
      value !== undefined ? encodeURIComponent(value) : undefined
    ]),
    ...config.mappingDefinitions.map((mapping): UrlParameter => [
      mapping.parameter,
      encodeMappedValue(keyValues, mapping)
    ])
  ];
};

/**
 * The TCF v2 consent parameters that `mapper.js` would add itself.
 */
const buildConsentParameters = (tcData: tcfapi.responses.TCData): ReadonlyArray<UrlParameter> => {
  const gdpr = tcData.gdprApplies === undefined ? undefined : tcData.gdprApplies ? '1' : '0';
  // CMPs may provide a tcString even if gdpr does not apply
  const tcString = 'tcString' in tcData ? tcData.tcString : undefined;
  return [
    ['cmp', '1'],
    ['gdpr', gdpr],
    ['gdpr_consent', tcString ? encodeURIComponent(tcString) : undefined],
    ['uc', '1_2']
  ];
};

const buildUrl = (baseUrl: string, parameters: ReadonlyArray<UrlParameter>): string => {
  const query = parameters
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([parameter, value]) => `${encodeURIComponent(parameter)}=${value}`)
    .join('&');

  return `${baseUrl}?${query}`;
};

/**
 * Creates the ROQAD Cookie Sync module.
 *
 * @see modules.roqad.RoqadModuleConfig
 */
export const createRoqad = (): IModule => {
  let roqadConfig: modules.roqad.RoqadModuleConfig | null = null;

  /**
   * The iframe of the last pixel sync. Removed before the next sync.
   */
  let syncIframe: HTMLIFrameElement | null = null;

  const syncWithMapper = (
    config: modules.roqad.RoqadModuleConfig,
    context: AdPipelineContext
  ): void => {
    context.assetLoaderService__
      .loadScript({
        name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: buildUrl(mapperUrl, buildPageParameters(config, context))
      })
      .catch(error => context.logger__.error(name, 'failed to load mapper.js', error));
  };

  const syncWithPixel = (
    config: modules.roqad.RoqadModuleConfig,
    context: AdPipelineContext
  ): void => {
    const document = context.window__.document;
    // no-op if the single page application already removed it
    syncIframe?.remove();

    const iframe = document.createElement('iframe');
    iframe.id = syncIframeId;
    iframe.title = 'ROQAD cookie sync';
    iframe.width = '0';
    iframe.height = '0';
    iframe.style.display = 'none';
    iframe.style.border = '0';
    iframe.src = buildUrl(pixelUrl, [
      ...buildPageParameters(config, context),
      ...buildConsentParameters(context.tcData__)
    ]);
    document.body.appendChild(iframe);
    syncIframe = iframe;
  };

  const sync = (
    config: modules.roqad.RoqadModuleConfig,
    context: AdPipelineContext
  ): Promise<void> => {
    if (!hasRequiredConsent(context.tcData__)) {
      return Promise.resolve();
    }

    if (config.syncMethod === 'pixel') {
      syncWithPixel(config, context);
    } else {
      syncWithMapper(config, context);
    }

    return Promise.resolve();
  };

  return {
    name,
    configKey: 'roqad',
    description: 'Performs the ROQAD cookie sync with page data after consent was given',
    moduleType: 'dmp' as ModuleType,

    config__: (): modules.roqad.RoqadModuleConfig | null => roqadConfig,

    configure__(moduleConfig?: modules.ModulesConfig): void {
      if (moduleConfig?.roqad?.enabled) {
        roqadConfig = moduleConfig.roqad;
      }
    },

    initSteps__(): InitStep[] {
      return [];
    },

    configureSteps__(): ConfigureStep[] {
      const config = roqadConfig;
      return config
        ? [mkConfigureStepOncePerRequestAdsCycle(name, context => sync(config, context))]
        : [];
    },

    prepareRequestAdsSteps__: (): PrepareRequestAdsStep[] => []
  };
};
