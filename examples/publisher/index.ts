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
import 'prebid.js/modules/unrulyBidAdapter';
import 'prebid.js/modules/ixBidAdapter';
import 'prebid.js/modules/dspxBidAdapter';
import 'prebid.js/modules/userId/index';
import 'prebid.js/modules/unifiedIdSystem';
import 'prebid.js/modules/rubiconBidAdapter';

import { initAdTag } from '@highfivve/ad-tag/source/ts/ads/moliGlobal';
import { adConfiguration } from './source/ts/configuration';
import Confiant from '@highfivve/module-confiant';

import BlocklistedUrls from '@highfivve/module-blocklist-url';
import Skin from '@highfivve/module-generic-skin';
import AdReload from '@highfivve/module-moli-ad-reload';
import YieldOptimization from '@highfivve/module-yield-optimization';

prebid.processQueue();

const moli = initAdTag(window);

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

moli.registerModule(
  new Skin(
    {
      trackSkinCpmLow: (cpms, skinConfig, skinBid) => {
        console.log('[SKIN]', cpms, skinConfig, skinBid);
      },
      configs: [
        {
          formatFilter: [{ bidder: 'justpremium', format: 'wp' }, { bidder: 'dspx' }],
          skinAdSlotDomId: 'prebid-adslot-2',
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false,
          blockedAdSlotDomIds: ['prebid-adslot', 'appnexus-native-example-1']
        }
      ]
    },
    window
  )
);

// configure yield optimization
moli.registerModule(
  new YieldOptimization(
    {
      provider: 'dynamic',
      configEndpoint: '//local.h5v.eu:9000/yield-config.json'
    },
    window
  )
);

// init moli
moli.configure(adConfiguration);
