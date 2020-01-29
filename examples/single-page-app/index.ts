// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

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
import Faktor from '@highfivve/module-cmp-faktor';

prebid.processQueue();

const moli = initAdTag(window);

moli.registerModule(new Faktor({
  autoOptIn: true
}, window));

moli.enableSinglePageApp();
// init moli
moli.configure(adConfiguration);

