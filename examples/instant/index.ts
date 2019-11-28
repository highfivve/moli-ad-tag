// Instant mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

import PrebidGoogleAnalytics from '@highfivve/module-prebid-google-analytics';
import Faktor from '@highfivve/module-cmp-faktor';

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

moli.registerModule(new Faktor({
  autoOptIn: true
}, window));

moli.configure(adConfiguration);
moli.requestAds();

console.log(adConfiguration);
