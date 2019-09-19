// Instant mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

import PrebidGoogleAnalytics from '@highfivve/module-prebid-google-analytics';

// init moli
const moli = initAdTag(window);

// register modules
moli.registerModule(new PrebidGoogleAnalytics({
  trackingId: 'UA-965201-41',
  options: {
    global: 'ga',
    trackerName: 'h5',
    sampling: 1,
    enableDistribution: true
  }
}, window));

moli.configure(adConfiguration);
moli.requestAds();

console.log(window.pbjs.version);
console.log(adConfiguration);
