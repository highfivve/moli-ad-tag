import 'moli-ad-tag/source/ts/types/moli';
import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

import { WindowResizeService } from './util/windowResizeService';
import { LabelConfigService } from '../source/ts/ads/labelConfigService';

const moliConfig: MoliConfig | undefined = window.moli.getConfig();

if (moliConfig) {
  const globalConfigElement = document.createElement('div');
  const extraLabels = moliConfig.targeting && moliConfig.targeting.labels || [];
  const labelConfigService = new LabelConfigService(moliConfig.labelSizeConfig || [], extraLabels);

  preact.render(<GlobalConfig config={moliConfig} labelConfigService={labelConfigService} windowResizeService={new WindowResizeService()}/>, globalConfigElement);

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement && labelConfigService.filterSlot(slot)) {
      preact.render(<AdSlotConfig labelConfigService={labelConfigService} slot={slot} parentElement={slotDomElement}/>, slotDomElement);
    }
  });
}
