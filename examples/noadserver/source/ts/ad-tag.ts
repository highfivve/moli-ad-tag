// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';
import 'prebid.js/modules/justpremiumBidAdapter';
import 'prebid.js/modules/pubmaticBidAdapter';
import 'prebid.js/modules/smartadserverBidAdapter';
import 'prebid.js/modules/teadsBidAdapter';
import 'prebid.js/modules/rubiconBidAdapter';
import 'prebid.js/modules/ixBidAdapter';

import 'prebid.js/modules/dspxBidAdapter';
// user ids
import 'prebid.js/modules/userId/index';
import 'prebid.js/modules/unifiedIdSystem';
import 'prebid.js/modules/priceFloors';

import { googletag, initAdTag, prebidjs } from '@highfivve/ad-tag';
import { Confiant } from '@highfivve/module-confiant';

import { BlocklistedUrls } from '@highfivve/module-blocklist-url';
import { Skin } from '@highfivve/module-generic-skin';
import { AdReload } from '@highfivve/module-moli-ad-reload';
import { YieldOptimization } from '@highfivve/module-yield-optimization';
import { adConfiguration } from './configuration';

prebid.processQueue();

const moli = initAdTag(window);

declare const window: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow;

window.pbjs.onEvent('bidWon', (bidWon: prebidjs.event.BidWonEvent) => {
  console.log('bidWon', bidWon);
});

// ad fraud protection
moli.registerModule(
  new Confiant(
    {
      assetUrl:
        'https://confiant-integrations.global.ssl.fastly.net/Fhkh8X7bib_CoPkwt4wiIcaO-vk/gpt_and_prebid/config.js'
    },
    window
  )
);

// blacklist urls
moli.registerModule(
  new BlocklistedUrls(
    {
      mode: 'block',
      blocklist: {
        provider: 'static',
        blocklist: {
          urls: [
            // { pattern: 'local\.h5v\.eu', matchType: 'regex' },
            { pattern: 'invalid', matchType: 'contains' }
          ]
        }
      }
    },
    window
  )
);

// !! ad reload does not work !!
// !! skin module does not work !!

// configure yield optimization
moli.registerModule(
  new YieldOptimization(
    {
      provider: 'dynamic',
      configEndpoint: '/yield-config.json',
      excludedAdUnitPaths: []
    },
    window
  )
);

// init moli
moli.configure(adConfiguration);
