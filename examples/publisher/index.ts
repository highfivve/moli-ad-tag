/**
 * ES6 bundle: no polyfills.
 */
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
import 'prebid.js/modules/priceFloors';

import { googletag, initAdTag, prebidjs } from '@highfivve/ad-tag';
import { Confiant } from '@highfivve/module-confiant';

import { BlocklistedUrls } from '@highfivve/module-blocklist-url';
import { Skin } from '@highfivve/module-generic-skin';
import { AdReload } from '@highfivve/module-moli-ad-reload';
import { YieldOptimization } from '@highfivve/module-yield-optimization';
import { StickyFooterAds } from '@highfivve/module-sticky-footer-ads';
import { adConfiguration } from './source/ts/configuration';

prebid.processQueue();

const moli = initAdTag(window);

declare const window: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow;

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
      refreshIntervalMs: 60000,
      refreshIntervalMsOverrides: {
        'appnexus-native-example-1': 40000
      },
      excludeAdSlotDomIds: [
        'lazy-adslot',
        'refreshable-adslot',
        'manual-adslot',
        'a9-adslot',
        'eager-loading-adslot-not-in-dom'
      ],
      optimizeClsScoreDomIds: [
        'appnexus-native-example-2',
        'appnexus-native-example-1',
        'eager-loading-adslot',
        'prebid-adslot-2'
      ],
      includeOrderIds: [2690210604, 2690917340, 2674536678],
      excludeOrderIds: [],
      includeAdvertiserIds: [
        4693931408 /* AppNexus */, 4868030566, 4858511198 /* gutefrage-intern */
      ]
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
      configEndpoint: '/yield-config.json',
      excludedAdUnitPaths: []
    },
    window
  )
);

// footer ads
moli.registerModule(
  new StickyFooterAds({
    mobileStickyDomId: 'ad-mobile-sticky',
    desktopFloorAdDomId: 'ad-floorad',
    disallowedAdvertiserIds: [4858511198]
  })
);

//
window.pbjs = window.pbjs || { que: [] };
window.pbjs.que.push(() => {
  window.pbjs.onEvent('bidWon', (bidWon: prebidjs.event.BidWonEvent) => {
    console.log('bidWon', bidWon);
  });
});

// init moli
moli.configure(adConfiguration(moli.version));
