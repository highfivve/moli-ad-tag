// Self contain
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
import { googletag, prebidjs, Moli, moli } from 'moli-ad-tag';
import { adConfiguration } from './source/ts/configuration';

// init moli
moli.configure(adConfiguration);

