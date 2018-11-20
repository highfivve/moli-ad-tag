import 'moli-ad-tag/source/ts/types/moli';
import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

const moliConfig: MoliConfig | undefined = window.moli.getConfig();

if (moliConfig) {
  const globalConfigElement = document.createElement('div');

  preact.render(<GlobalConfig config={moliConfig}/>, globalConfigElement);

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement) {
      preact.render(<AdSlotConfig slot={slot} parentElement={slotDomElement}/>, slotDomElement);
    }
  });
}
