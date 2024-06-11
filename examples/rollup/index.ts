// depend on the ad-tag library that was build locally
import type { MoliRuntime } from '../../lib';
import '../../lib/bundle/init';
import '../../lib/bundle/instant';
import '../../lib/bundle/pubstack';

declare const window: MoliRuntime.MoliWindow;

window.moli.que.push(moli => {
  moli.configure({
    slots: [
      {
        domId: 'content_1',
        adUnitPath: '/1/content_1',
        behaviour: {
          loaded: 'eager'
        },
        position: 'in-page',
        sizes: [
          [300, 250],
          [300, 600]
        ],
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [
              [300, 250],
              [300, 600]
            ]
          }
        ]
      }
    ],
    schain: {
      supplyChainStartNode: {
        sid: '1234',
        hp: 1,
        asi: 'example.com'
      }
    }
  });
});
