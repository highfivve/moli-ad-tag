import type { MoliRuntime } from '../types/moliRuntime';

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
 *
 * @module
 */
declare const window: MoliRuntime.MoliWindow;

const currentScript: HTMLElement | SVGScriptElement | null =
  window.document.currentScript ?? document.getElementById('moli-ad-tag');

if (currentScript) {
  const publisherCode = currentScript.getAttribute('data-pub-code');
  const version = currentScript.getAttribute('data-version') ?? 'prod';
  const endpoint = currentScript.getAttribute('data-endpoint') ?? 'cdn.h5v.eu/publisher/config';

  if (publisherCode) {
    const url = `//${endpoint}/${publisherCode}/${version}.json`;
    fetch(url)
      .then(response => response.json())
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
