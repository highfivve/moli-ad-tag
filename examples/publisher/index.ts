// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import 'prebid.js/build/dist/prebid';
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

const moli = initAdTag(window);

// ad fraud protection
import Confiant from '@highfivve/module-confiant';
moli.registerModule(new Confiant({
  assetUrl: 'https://confiant-integrations.global.ssl.fastly.net/Fhkh8X7bib_CoPkwt4wiIcaO-vk/gpt_and_prebid/config.js'
}, window));

// init moli
moli.configure(adConfiguration);

