// IE 11 compatible
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Full configuration to work with IE11

// polyfill promise for IE11
import 'core-js/es/promise';

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

// init moli
const moli = initAdTag(window);
moli.configure(adConfiguration);
moli.requestAds();
