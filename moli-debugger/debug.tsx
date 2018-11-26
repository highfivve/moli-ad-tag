import 'moli-ad-tag/source/ts/types/moli';
import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

const moliConfig: MoliConfig | undefined = window.moli.getConfig();

if (moliConfig) {
  const globalConfigElement = document.createElement('div');
  const extraLabels = moliConfig.targeting && moliConfig.targeting.labels || [];
  const defaultLogger = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  const sizeConfigService = new SizeConfigService(moliConfig.sizeConfig || [], extraLabels, moliConfig.logger || defaultLogger);

  preact.render(<GlobalConfig sizeConfigService={sizeConfigService} config={moliConfig}/>, globalConfigElement);

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement && sizeConfigService.filterSlot(slot)) {
      preact.render(<AdSlotConfig sizeConfigService={sizeConfigService} slot={slot} parentElement={slotDomElement}/>, slotDomElement);
    }
  });
}
