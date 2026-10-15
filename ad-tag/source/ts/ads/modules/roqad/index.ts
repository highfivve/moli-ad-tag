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
 * | `env`            | always `mWeb`. ROQAD only supports `mWeb` for website calls and does not    |
 * |                  | process `desktop`.                                                          |
 * | `eventType`      | always `pageview`                                                           |
 * | `publisher_name` | `publisherName` from the module config                                      |
 * | `partner_dom`    | `window.location.hostname`                                                  |
 * | `ctry`           | the country as ISO 3166-1 alpha-2 code, uppercased. `targeting.geo.country` |
 * |                  | if set, otherwise the country detected from the browser timezone. Omitted   |
 * |                  | if it is no alpha-2 code, so ROQAD derives it from the request IP.          |
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
 * runtime key-values win. Array values are sent comma-separated. If the value is empty, the
 * `defaultValue` is used, or the parameter is omitted.
 *
 * ### Empty parameters
 *
 * A parameter whose value is `null`, `undefined`, an empty or whitespace-only string or an empty
 * array is omitted from the sync URL entirely - there is no `param=` left behind. This applies to
 * the fixed parameters, the parameter mappings and the consent parameters alike, and to a
 * mapping's `defaultValue` itself: a blank default omits the parameter.
 *
 * Empty array elements are dropped before joining, so `['news', '', 'sport']` is sent as
 * `news,sport`. An array without a single non-empty element falls back to the `defaultValue` or
 * is omitted.
 *
 * Emptiness is tested on the trimmed value, but values that are sent go out untrimmed - moli does
 * not rewrite publisher data.
 *
 * ### Configuration errors
 *
 * A blank `zdid` or `publisherName` is a configuration error: ROQAD cannot attribute such a sync,
 * so the module is not activated and logs an error instead of firing a request. `enabled: true`
 * therefore does not imply that the module runs.
 *
 * ### Geo
 *
 * The country is resolved per field: the configured `targeting.geo.country` wins, otherwise the
 * country detected from the browser timezone is used. Label resolution in `moli.ts` falls back as
 * a whole object instead.
 *
 * @see docs/adr/0015-roqad-resolves-geo-locally-with-per-field-precedence.md
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
  mkConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import { detectGeoFromBrowser } from 'ad-tag/util/detectGeoFromTimezone';

const name = 'roqad';

const mapperUrl = 'https://zd.rqtrk.eu/mapper.js';

const pixelUrl = 'https://zd.rqtrk.eu/';

const syncIframeId = 'h5v-roqad-sync';

/**
 * IAB global vendor list ids that must have consent: Roq.ad (4) and zeotap (301)
 */
const requiredVendorIds = [4, 301] as const;

/**
 * A URL parameter name and its raw, unencoded value.
 *
 * The value is kept raw so that emptiness filtering, array joining and URL encoding all happen
 * in one place - {@link encodeParameterValue} - instead of each parameter source encoding its
 * own value. `null` is not part of `googleAdManager.KeyValueMap`, but runtime key-values come
 * from publisher javascript and are untrusted, so it is accepted here rather than widening
 * `KeyValueMap`.
 */
type UrlParameterValue = string | ReadonlyArray<string> | null | undefined;

type UrlParameter = readonly [name: string, value: UrlParameterValue];

const hasRequiredConsent = (tcData: tcfapi.responses.TCData): boolean =>
  !tcData.gdprApplies ||
  (requiredVendorIds.every(vendorId => tcData.vendor.consents[vendorId]) &&
    !!tcData.purpose.consents[tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE]);

/**
 * A value is empty if it is not set or blank. Emptiness is tested on the trimmed value, the
 * value itself is never trimmed - moli does not rewrite publisher data.
 */
const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.trim().length > 0;

// Array.isArray does not narrow a ReadonlyArray out of the union, so this guard does
const isArrayValue = (value: UrlParameterValue): value is ReadonlyArray<string> =>
  Array.isArray(value);

const hasValue = (value: UrlParameterValue): boolean =>
  isArrayValue(value) ? value.some(hasText) : hasText(value);

/**
 * Returns the URL-encoded value, or `undefined` if the parameter should be omitted entirely.
 * Empty array elements are dropped before joining.
 */
const encodeParameterValue = (value: UrlParameterValue): string | undefined => {
  if (isArrayValue(value)) {
    const elements = value.filter(hasText);
    return elements.length > 0 ? elements.map(encodeURIComponent).join(',') : undefined;
  }
  return hasText(value) ? encodeURIComponent(value) : undefined;
};

/**
 * Returns the raw value for a mapping. Falls back to the `defaultValue` if the key-value is
 * empty. A blank `defaultValue` is empty as well and omits the parameter.
 */
const resolveMappedValue = (
  keyValues: googleAdManager.KeyValueMap,
  mapping: modules.roqad.RoqadParameterMapping
): UrlParameterValue => {
  const value = keyValues[mapping.key];
  return hasValue(value) ? value : mapping.defaultValue;
};

/**
 * The ISO 3166-1 alpha-2 country code sent as `ctry`, or `undefined` if there is none - ROQAD
 * then derives the country from the request IP, which is better defined than a bogus value.
 *
 * Geo is resolved per field: the publisher-configured country wins, otherwise the country
 * detected from the browser timezone is used, even if the geo config sets other fields.
 */
const resolveCountry = (context: AdPipelineContext): string | undefined => {
  const configuredCountry = context.config__.targeting?.geo?.country;
  const country = hasValue(configuredCountry)
    ? configuredCountry
    : detectGeoFromBrowser(context.window__).country;

  if (country === undefined) {
    return undefined;
  }

  // ctry is normalized anyway - it is uppercased - so surrounding whitespace is not a reason to
  // discard an otherwise valid country code. This is not publisher data passed through, unlike
  // the mapped parameter values.
  const countryCode = country.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(countryCode)) {
    return countryCode;
  }

  context.logger__.warn(
    name,
    `ignoring country '${country}', expected an ISO 3166-1 alpha-2 country code`
  );
  return undefined;
};

/**
 * The fixed parameters and the parameter mappings with their raw values. Shared by both sync
 * methods. Encoding and emptiness filtering happen in {@link buildUrl}.
 */
const buildPageParameters = (
  config: modules.roqad.RoqadModuleConfig,
  context: AdPipelineContext
): ReadonlyArray<UrlParameter> => {
  const hem = context.runtimeConfig__.audience?.hem;
  const hashedEmail = hem?.sha256BasicNormalized ?? hem?.sha256;

  const keyValues: googleAdManager.KeyValueMap = {
    ...context.config__.targeting?.keyValues,
    ...context.runtimeConfig__.keyValues
  };

  const fixedParameters: ReadonlyArray<UrlParameter> = [
    ['zdid', config.zdid],
    // ROQAD only supports mWeb for website calls. Calls with env=desktop are not processed and
    // the sync pixels do not fire, so this is not derived from the device label.
    ['env', 'mWeb'],
    ['eventType', 'pageview'],
    ['publisher_name', config.publisherName],
    ['partner_dom', context.window__.location.hostname],
    ['ctry', resolveCountry(context)],
    ['z_e_sha2_l', hashedEmail]
  ];

  return [
    ...fixedParameters,
    ...config.mappingDefinitions.map((mapping): UrlParameter => [
      mapping.parameter,
      resolveMappedValue(keyValues, mapping)
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
    ['gdpr_consent', tcString],
    ['uc', '1_2']
  ];
};

const buildUrl = (baseUrl: string, parameters: ReadonlyArray<UrlParameter>): string => {
  const query = parameters
    .map(([parameter, value]): readonly [string, string | undefined] => [
      parameter,
      encodeParameterValue(value)
    ])
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
   * Set if the module was enabled with an unusable config. The module stays inactive, but the
   * error needs the pipeline logger, which only a step has access to.
   */
  let configError: string | null = null;

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
      // configure__ may run again, e.g. in a single page application. Reset both, so a later
      // configuration never inherits the activation or the error of the previous one.
      roqadConfig = null;
      configError = null;

      const config = moduleConfig?.roqad;
      if (!config?.enabled) {
        return;
      }

      // a sync without these cannot be attributed by ROQAD, so `enabled: true` alone does not
      // activate the module
      if (!hasText(config.zdid) || !hasText(config.publisherName)) {
        configError = 'zdid and publisherName must not be empty. Module is not activated';
      } else {
        roqadConfig = config;
      }
    },

    initSteps__(): InitStep[] {
      return [];
    },

    configureSteps__(): ConfigureStep[] {
      const config = roqadConfig;
      if (config) {
        return [mkConfigureStepOncePerRequestAdsCycle(name, context => sync(config, context))];
      }

      const error = configError;
      if (!error) {
        return [];
      }

      // the module is inactive and fires nothing - this step exists only to surface the error,
      // because configure__ has no logger. It logs once, not once per requestAds cycle.
      let logged = false;
      return [
        mkConfigureStep(`${name}-config-error`, context => {
          if (!logged) {
            logged = true;
            context.logger__.error(name, error);
          }
          return Promise.resolve();
        })
      ];
    },

    prepareRequestAdsSteps__: (): PrepareRequestAdsStep[] => []
  };
};
