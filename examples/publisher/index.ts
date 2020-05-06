// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
// import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';
import 'prebid.js/modules/justpremiumBidAdapter';
import 'prebid.js/modules/pubmaticBidAdapter';
import 'prebid.js/modules/smartadserverBidAdapter';
import 'prebid.js/modules/teadsBidAdapter';
import 'prebid.js/modules/unrulyBidAdapter';
import 'prebid.js/modules/ixBidAdapter';
import 'prebid.js/modules/dspxBidAdapter';
import 'prebid.js/modules/userId/index';
import 'prebid.js/modules/unifiedIdSystem';
import 'prebid.js/modules/rubiconBidAdapter';

import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';
import Cmp from '@highfivve/module-cmp-faktor';
import Confiant from '@highfivve/module-confiant';

prebid.processQueue();

const moli = initAdTag(window);

// ad fraud protection
moli.registerModule(new Confiant({
  assetUrl: 'https://confiant-integrations.global.ssl.fastly.net/Fhkh8X7bib_CoPkwt4wiIcaO-vk/gpt_and_prebid/config.js'
}, window));

// cmp
moli.registerModule(new Cmp({ autoOptIn: true }, window));

// init moli
moli.configure(adConfiguration);
