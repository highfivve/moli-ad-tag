// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import prebid from 'prebid.js';
import 'prebid.js/modules/consentManagement';
import 'prebid.js/modules/currency';
import 'prebid.js/modules/appnexusBidAdapter';

import { googletag, initAdTag, Moli, prebidjs } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';
import { LazyLoad } from '@highfivve/module-moli-lazy-load';
import MoliWindow = Moli.MoliWindow;

prebid.processQueue();

const moli = initAdTag(window);
declare const window: Window & googletag.IGoogleTagWindow & MoliWindow & prebidjs.IPrebidjsWindow;

moli.beforeRequestAds(_ => {
  console.log('BEFORE REQUEST ADS HOOK');
});

moli.enableSinglePageApp();
// init moli

moli.registerModule(
  new LazyLoad(
    {
      slots: [{ domIds: ['lazy-loading-adslot-1'], options: { threshold: 0.5 } }],
      buckets: [],
      infiniteSlots: []
    },
    window
  )
);
moli.configure(adConfiguration);
