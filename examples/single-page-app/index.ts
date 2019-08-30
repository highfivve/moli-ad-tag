// Publisher mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example demonstrates the "publisher" mode, which enables the publisher
// to configure moli and trigger `requestAds` afterwards.

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { moli } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

moli.enableSinglePageApp();
// init moli
moli.configure(adConfiguration);

