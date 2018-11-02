// Self contain
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
import { googletag, prebidjs, Moli, moli } from 'moli-ad-tag';
import { adConfiguration } from './source/ts/configuration';

// prepare window
declare const window: Window & googletag.IGlobalGoogleTagApi & prebidjs.IGlobalPrebidJsApi & Moli.MoliWindow;

// init moli
moli.initialize(adConfiguration);


console.log(window.pbjs.version);
console.log(adConfiguration);
