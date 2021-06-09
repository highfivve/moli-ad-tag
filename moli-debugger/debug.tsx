import React from 'react';
import { render } from 'react-dom';

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import { LabelConfigService } from '@highfivve/ad-tag/source/ts/ads/labelConfigService';

import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { ModuleMeta } from '@highfivve/ad-tag/source/ts/types/module';

import MoliConfig = Moli.MoliConfig;

import './debug.css';

import { ThemingService } from './util/themingService';
import { WindowResizeService } from './util/windowResizeService';

declare const window: Moli.MoliWindow;

const moliConfig: MoliConfig | null = window.moli.getConfig();
const modulesMeta: Array<ModuleMeta> =
  'getModuleMeta' in window.moli ? window.moli.getModuleMeta() : [];

if (moliConfig) {
  const globalConfigElement = document.createElement('div');
  const extraLabels = (moliConfig.targeting && moliConfig.targeting.labels) || [];
  const labelConfigService = new LabelConfigService(
    moliConfig.labelSizeConfig || [],
    extraLabels,
    window
  );

  const themingService = new ThemingService(globalConfigElement);
  themingService.applyTheme();
  themingService.enableSystemThemeListener();

  render(
    <GlobalConfig
      config={moliConfig}
      modules={modulesMeta}
      labelConfigService={labelConfigService}
      windowResizeService={new WindowResizeService()}
      themingService={themingService}
    />,
    globalConfigElement
  );

  document.body.appendChild(globalConfigElement);

  moliConfig.slots.forEach(slot => {
    const slotDomElement = document.getElementById(slot.domId);
    if (slotDomElement && labelConfigService.filterSlot(slot)) {
      render(
        <AdSlotConfig
          labelConfigService={labelConfigService}
          slot={slot}
          parentElement={slotDomElement}
        />,
        slotDomElement
      );
    }
  });
} else {
  window.alert('No moli config found. The console cannot be displayed');
}
