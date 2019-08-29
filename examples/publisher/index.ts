// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { moli } from 'moli-ad-tag/source/ts/ads/moliGlobal';
import { adConfiguration } from './source/ts/configuration';

import Confiant from 'moli-ad-tag/modules/Confiant';
new Confiant({
  gpt: {
    propertyId: 'Fhkh8X7bib_CoPkwt4wiIcaO-vk',
    confiantCdn: 'clarium.global.ssl.fastly.net',
    sandbox: 0,
    mapping: 'W3siaSI6MiwidCI6Int7b319Ont7d319eHt7aH19IiwicCI6MCwiRCI6MSwiciI6W119LHsiaSI6NiwidCI6Int7Y299fTp7e3d9fXh7e2h9fSIsInAiOjUwLCJEIjowLCJyIjpbeyJ0IjoiZXgiLCJzIjpudWxsLCJ2IjoiY28ifV19XQ==',
    activation: '|||MjQ4OTcwNjkzMQ==,|||MjQ5MDMxMzE3Mw==,|||MjQ4OTcwNjkzMQ==,|||MjQ5OTg5Mjk0NA==,|||MjQ5ODM3MjEyMA==,|co|ex|MQ==,|||MjQ5Mzc2NTI3Nw=='
  }
});

// init moli
moli.configure(adConfiguration);

