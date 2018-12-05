// Instant mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { moli } from 'moli-ad-tag/source/ts/ads/moliGlobal';
import { adConfiguration } from './source/ts/configuration';

// init moli
moli.configure(adConfiguration);
moli.requestAds();

console.log(window.pbjs.version);
console.log(adConfiguration);
