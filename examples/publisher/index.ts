// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import 'prebid.js/build/dev/prebid';
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';
import Faktor from '@highfivve/module-cmp-faktor';
import Confiant from '@highfivve/module-confiant';

const moli = initAdTag(window);

// ad fraud protection
moli.registerModule(new Confiant({
  assetUrl: 'https://confiant-integrations.global.ssl.fastly.net/Fhkh8X7bib_CoPkwt4wiIcaO-vk/gpt_and_prebid/config.js'
}, window));

// cmp
moli.registerModule(new Faktor({
  autoOptIn: false
}, window));

// init moli
moli.configure(adConfiguration);

