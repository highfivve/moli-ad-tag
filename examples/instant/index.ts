// Instant mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';
import 'prebid.js/modules/pubmaticBidAdapter';
import 'prebid.js/modules/smartadserverBidAdapter';
import 'prebid.js/modules/teadsBidAdapter';
import 'prebid.js/modules/unrulyBidAdapter';

import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

import PrebidGoogleAnalytics from '@highfivve/module-prebid-google-analytics';
import SourcepointCmp from '@highfivve/module-cmp-sourcepoint';

prebid.processQueue();

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

moli.registerModule(new SourcepointCmp({ rejectOnMissingPurposeOne: false }, window));

moli.configure(adConfiguration);
moli.requestAds();

console.log(adConfiguration);
