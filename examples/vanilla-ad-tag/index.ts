// Vanilla ad  tag
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This example builds an ad tag without any configuration or modules

import { initAdTag, Moli } from '@highfivve/ad-tag';

initAdTag(window);

const config: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      sizes: [[300, 250]],
      sizeConfig: [{ mediaQuery: '(min-width: 0px)', sizesSupported: [[300, 250]] }]
    }
  ],
  environment: 'test',
  schain: {
    supplyChainStartNode: {
      asi: 'highfivve.com',
      sid: '2001',
      hp: 1
    }
  }
};
