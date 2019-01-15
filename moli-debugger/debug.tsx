import 'moli-ad-tag/source/ts/types/moli';
import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

import { WindowResizeService } from './util/windowResizeService';

const moliConfig: MoliConfig | undefined = window.moli.getConfig();

if (moliConfig) {
  const globalConfigElement = document.createElement('div');
  const extraLabels = moliConfig.targeting && moliConfig.targeting.labels || [];
  const sizeConfigService = new SizeConfigService(moliConfig.sizeConfig || [], extraLabels);

  preact.render(<GlobalConfig config={moliConfig} sizeConfigService={sizeConfigService} windowResizeService={new WindowResizeService()}/>, globalConfigElement);

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement && sizeConfigService.filterSlot(slot)) {
      preact.render(<AdSlotConfig sizeConfigService={sizeConfigService} slot={slot} parentElement={slotDomElement}/>, slotDomElement);
    }
  });
}
