import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { Moli } from '@highfivve/ad-tag';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

import { WindowResizeService } from './util/windowResizeService';
import { LabelConfigService } from '@highfivve/ad-tag/source/ts/ads/labelConfigService';

const moliConfig: MoliConfig | null = window.moli.getConfig();

if (moliConfig) {
  const globalConfigElement = document.createElement('div');
  const extraLabels = moliConfig.targeting && moliConfig.targeting.labels || [];
  const labelConfigService = new LabelConfigService(moliConfig.labelSizeConfig || [], extraLabels, window);

  preact.render(<GlobalConfig config={moliConfig} labelConfigService={labelConfigService} windowResizeService={new WindowResizeService()}/>, globalConfigElement);

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement && labelConfigService.filterSlot(slot)) {
      preact.render(<AdSlotConfig labelConfigService={labelConfigService} slot={slot} parentElement={slotDomElement}/>, slotDomElement);
    }
  });
} else {
  window.alert('No moli config found. The console cannot be displayed');
}
