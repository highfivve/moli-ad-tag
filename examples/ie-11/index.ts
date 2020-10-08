// IE 11 compatible
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Full configuration to work with IE11

// polyfill promise for IE11
import 'core-js/es/promise';

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
import SourcepointCmp from '@highfivve/module-cmp-sourcepoint';

prebid.processQueue();

// init moli
const moli = initAdTag(window);

moli.registerModule(new SourcepointCmp({ rejectOnMissingPurposeOne: false }, window));

moli.configure(adConfiguration);
moli.requestAds();
