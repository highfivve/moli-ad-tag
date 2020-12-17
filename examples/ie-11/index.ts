// IE 11 compatible
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Full configuration to work with IE11

// polyfill promise for IE11
import 'core-js/es/promise';
import 'core-js/es/string';
import 'core-js/es/object';
import 'core-js/es/array';
import 'whatwg-fetch';

import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';
import 'prebid.js/modules/pubmaticBidAdapter';
import 'prebid.js/modules/smartadserverBidAdapter';
import 'prebid.js/modules/teadsBidAdapter';
import 'prebid.js/modules/unrulyBidAdapter';

import { initAdTag } from '@highfivve/ad-tag/source/ts/ads/moliGlobal';
import { adConfiguration } from './source/ts/configuration';
import AdReload from '@highfivve/module-moli-ad-reload';

prebid.processQueue();

// init moli
const moli = initAdTag(window);

moli.registerModule(
  new AdReload(
    {
      refreshIntervalMs: 10000,
      excludeAdSlotDomIds: [
        'lazy-adslot',
        'refreshable-adslot',
        'manual-adslot',
        'a9-adslot',
        'prebid-adslot-2',
        'prebid-adslot',
        'eager-loading-adslot-not-in-dom',
        'eager-loading-adslot'
      ],
      includeOrderIds: [],
      excludeOrderIds: [],
      includeAdvertiserIds: [4693931408 /* AppNexus */]
    },
    window
  )
);

moli.configure(adConfiguration);
