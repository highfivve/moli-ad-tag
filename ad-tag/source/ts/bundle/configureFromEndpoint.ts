import type { MoliRuntime } from '../types/moliRuntime';
import { QueryParameters } from '../util/queryParameters';
import { resolveOverrides } from '../util/resolveOverrides';
import { BrowserStorageKeys } from '../util/browserStorageKeys';

/**
 * # Configure from endpoint
 *
 * If you add this to your ad tag bundle, you can configure the ad tag from an endpoint.
 * All required parameters are passed as attributes to the script tag that loads the ad tag.
 *
 * # Usage
 *
 * The following attributes are supported:
 *
 * - `data-pub-code` - The publisher code that should be used to load the configuration.
 * - `data-version` (default is `prod`) - The configuration version that should be loaded. Usually this is either `prod` or `staging`.
 *    You can also use a specific version number, like `15`.
 * - `data-endpoint` (optional) - The endpoint that should be called to load the configuration.
 * - `data-endpoint-fallback` (optional) - The endpoint that should be called to load the configuration.
 *
 * ```html
 * <script id="moli-ad-tag" src="path/to/your/ad-tag-bundle.js"
 *         data-publisher-code="yourCode"
 *         data-version="prod"
 *         data-endpoint="cdn.h5v.eu/publishers"
 *         data-endpoint-fallback="cdn-fallback.h5v.eu/publishers"
 * ></script>
 * ```
 *
 * @module
 */
declare const window: MoliRuntime.MoliWindow;

const currentScript: HTMLElement | SVGScriptElement | null =
  window.document.currentScript ?? document.getElementById('moli-ad-tag');

// fetch overrides if available. We use the first value if multiple are available, keeping the default precedence order,
// which is query param > localStorage > sessionStorage.
const pubCodeOverride = resolveOverrides(
  window,
  QueryParameters.moliPubCode,
  BrowserStorageKeys.moliPubCode
)[0]?.value;

const versionOverride = resolveOverrides(
  window,
  QueryParameters.moliVersion,
  BrowserStorageKeys.moliVersion
)[0]?.value;

// if we can't detect the current script, we can't load the configuration and something is really off
if (currentScript) {
  // publisher code and version can be overridden via query parameters
  const publisherCode = pubCodeOverride ?? currentScript.getAttribute('data-publisher-code');
  const version = versionOverride ?? currentScript.getAttribute('data-version') ?? 'production';

  // make the configLabel available for the ad tag bundle. This info is sent along to prebid server for telemetry.
  window.moli.configLabel = version;

  const endpoint = currentScript.getAttribute('data-endpoint') ?? 'api.h5v.eu/publishers';
  const fallback = currentScript.getAttribute('data-endpoint-fallback') ?? 'cdn.h5v.eu/publishers';

  if (publisherCode) {
    const path = `/${publisherCode}/configs/${version}/config.json`;
    const url = `//${endpoint}/${path}`;
    fetch(url, { mode: 'cors' })
      .then(response => response.json())
      .catch(error => {
        console.error(`Failed to load configuration from ${url}. Using fallback`, error);
        return fetch(`//${fallback}/${path}`, { mode: 'cors' });
      })
      .then(config => window.moli.configure(config))
      .catch(error => console.error(`Failed to load configuration from ${url}:`, error));
  } else {
    console.error(
      'No publisher code provided for ad tag configuration! Add the `data-pub-code="yourCode"` attribute to the script tag.'
    );
  }
} else {
  console.error('Failed to find the current script tag for the ad tag bundle!');
}
