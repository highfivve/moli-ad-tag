/**
 * ES6 bundle: no polyfills.
 */

import { googletag, initAdTag, Moli, prebidjs } from '@highfivve/ad-tag';
import { Confiant } from '@highfivve/module-confiant';

import { BlocklistedUrls } from '@highfivve/module-blocklist-url';
import { AdexModule } from '@highfivve/module-the-adex-dmp';
import { AdReload } from '@highfivve/module-moli-ad-reload';
import { YieldOptimization } from '@highfivve/module-yield-optimization';
import { StickyFooterAdsV2 } from '@highfivve/module-sticky-footer-ads-v2';
import { Cleanup } from '../../modules/cleanup';

import { LazyLoad } from '@highfivve/module-moli-lazy-load';
import { adConfiguration } from './source/ts/configuration';
import MoliWindow = Moli.MoliWindow;
import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';
import 'prebid.js/modules/pubmaticBidAdapter';
import 'prebid.js/modules/teadsBidAdapter';
import 'prebid.js/modules/unrulyBidAdapter';
import 'prebid.js/modules/ixBidAdapter';
import 'prebid.js/modules/dspxBidAdapter';
import 'prebid.js/modules/userId/index';
import 'prebid.js/modules/unifiedIdSystem';
import 'prebid.js/modules/rubiconBidAdapter';
import 'prebid.js/modules/priceFloors';
import { StickyHeaderAds } from '@highfivve/module-sticky-header-ads';

prebid.processQueue();

const moli = initAdTag(window);

declare const window: Window & googletag.IGoogleTagWindow & MoliWindow & prebidjs.IPrebidjsWindow;

moli.enableSinglePageApp();
// ad fraud protection
moli.registerModule(
  new Confiant({
    assetUrl:
      'https://confiant-integrations.global.ssl.fastly.net/Fhkh8X7bib_CoPkwt4wiIcaO-vk/gpt_and_prebid/config.js'
  })
);

// Add lazy loading module
moli.registerModule(
  new LazyLoad(
    {
      slots: [
        { domIds: ['lazy-loading-adslot-1', 'lazy-loading-adslot-2'], options: { threshold: 0.5 } }
      ],
      buckets: [
        { bucket: 'lazy-bucket', observedDomId: 'lazy-bucket3', options: { threshold: 0.2 } }
      ],
      infiniteSlots: [{ selector: '.ad-infinite', options: { threshold: 0.5 } }]
    },
    window
  )
);

// blocklist urls
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
        'manual-adslot',
        'a9-adslot',
        'eager-loading-adslot-not-in-dom',
        'infinite-loading-adslot'
      ],
      optimizeClsScoreDomIds: [
        'appnexus-native-example-2',
        'appnexus-native-example-1',
        'eager-loading-adslot'
      ],
      includeOrderIds: [2690210604, 2690917340, 2674536678],
      excludeOrderIds: [],
      includeAdvertiserIds: [
        4693931408 /* AppNexus */, 4868030566, 4858511198 /* gutefrage-intern */
      ],
      includeYieldGroupIds: []
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
/*
moli.registerModule(
  new StickyFooterAds({
    mobileStickyDomId: 'ad-mobile-sticky',
    desktopFloorAdDomId: 'ad-floorad',
    disallowedAdvertiserIds: [
      //4858511198
       //gutefrage-intern
    ]
  })
);
*/

moli.registerModule(
  new StickyFooterAdsV2({
    stickyFooterDomIds: {
      desktop: 'ad-desktop-sticky',
      mobile: 'ad-mobile-sticky'
    },

    disallowedAdvertiserIds: [
      /*4858511198*/
      // gutefrage-intern
    ],
    closingButtonText: 'schließen'
  })
);

moli.registerModule(
  new StickyHeaderAds({
    headerAdDomId: 'ad-header',
    navbarConfig: {
      selector: 'nav',
      navbarHiddenClassName: 'header-ad--navbarHidden'
    },
    fadeOutTrigger: {
      selector: '#fadeOut--trigger'
    },
    fadeOutClassName: 'header-ad--fadeOut',
    disallowedAdvertiserIds: [],
    waitForRendering: true,
    minVisibleDurationMs: 1500
  })
);

moli.setTargeting('advertising_id', 'a5f670e6-5afe-4bb2-9e9b-22f49b6efcbc');
moli.setTargeting('gf_clientType', 'android');

moli.registerModule(
  new AdexModule(
    {
      mappingDefinitions: [
        {
          adexValueType: 'map',
          attribute: 'gf_iab_cat',
          key: 'channel',
          valueKey: 'subChannel',
          defaultValue: 'None',
          valueType: 'string'
        },
        {
          adexValueType: 'string',
          attribute: 'gf_device_type',
          key: 'device_type'
        },
        {
          adexValueType: 'string',
          attribute: 'gf_page_searchterm',
          key: 'page_searchterm'
        },
        {
          adexValueType: 'string',
          attribute: 'gf_page_tag',
          key: 'page_tag'
        },
        {
          adexValueType: 'string',
          attribute: 'gf_target_audience_gender',
          key: 'target_audience_gender'
        },
        {
          adexValueType: 'list',
          attribute: 'gf_iab_v3',
          key: 'iab_v3'
        }
      ],
      spaMode: false,
      adexCustomerId: '808',
      adexTagId: '3280',
      appConfig: {
        clientTypeKey: 'gf_clientType',
        advertiserIdKey: 'advertising_id',
        adexMobileTagId: '7484'
      }
    },
    window
  )
);

moli.registerModule(
  new Cleanup({
    configs: [
      {
        bidder: 'Seedtag',
        deleteMethod: {
          cssSelectors: ['.seedtag-container']
        }
      }
    ]
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

// make sure that 'bucket-one' isn't configured as lazy bucket
window.moli.que.push(adTag => adTag.refreshBucket('bucket-one'));
