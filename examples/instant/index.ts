// Instant mode example
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example means a fully self-contained publisher ad tag, which only needs to be added and things just work

import 'prebid.js/build/dist/prebid';
// with `yarn link` we cannot import from the `index.ts` for unknown reasons.
// ts-loader bails out, because no js has been emitted
import { initAdTag } from '@highfivve/ad-tag';
import { adConfiguration } from './source/ts/configuration';

(window as any).ga = (window as any).ga || function init(): void {
  ga.q = ga.q || [];
  ga.q.push(arguments);
};
ga.l = +new Date;

ga('create', 'UA-965201-41', 'auto', 'h5');
ga('h5.send', 'pageview');

// configure prebid
window.pbjs.enableAnalytics([ {
  provider: 'ga',
  options: {
    global: 'ga',
    trackerName: 'h5',
    sampling: 1,
    enableDistribution: true
  }
} ]);

// init moli
const moli = initAdTag(window);
moli.configure(adConfiguration);
moli.requestAds();

console.log(window.pbjs.version);
console.log(adConfiguration);
