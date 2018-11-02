// First test code
import 'prebid.js/build/dist/prebid';
import { googletag } from 'moli-ad-tag/source/ts/types/googletag';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { adConfiguration } from './source/ts/configuration';


// TODO this should be provided by moli
/**
 * The Global Google Tag API.
 */
interface IGlobalGoogleTagApi {
  /**
   * Google Publisher Tag (gpt.js)
   * @see {@link https://developers.google.com/doubleclick-gpt/reference}
   */
  googletag: googletag.IGoogleTag;
}

// TODO this should be only a Window & MoliWindow
declare const window: Window & IGlobalGoogleTagApi & prebidjs.IGlobalPrebidJsApi;

// TODO this should be done by moli
window.googletag = window.googletag || {};
window.googletag.cmd = window.googletag.cmd || [];

// TODO remove this. The DfpService takes care of this
window.googletag.cmd.push(function () {
  window.googletag.defineSlot('/33559401/gf/fragen/RelatedContentStream3', [[536, 185], [280, 185], [605, 165], [300, 250], [316, 185]], 'adslot-1')
    .addService(window.googletag.pubads());
  window.googletag.pubads().enableSingleRequest();
  window.googletag.enableServices();
  window.googletag.display('adslot-1');
  console.log('enable google!');
});

console.log(window.pbjs.version);
console.log(adConfiguration);

// Implementation that should compile
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

// import 'prebid.js/build/dist/prebid';
// import { googletag, prebidjs, moli } from 'moli-ad-tag';
// import { adConfiguration } from './source/ts/configuration';

// prepare window
// declare const window: Window & moli.Window;

// init moli
// moli.initialize(adConfiguration);

