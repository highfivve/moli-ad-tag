import React from 'react';
import { createRoot } from 'react-dom/client';

import { GlobalConfig } from './components/globalConfig';
import { AdSlotConfig } from './components/adSlotConfig';

import './debug.pcss';

import { ThemingService } from './util/themingService';
import { WindowResizeService } from './util/windowResizeService';
import type { MoliRuntime } from '../types/moliRuntime';
import type { MoliConfig } from '../types/moliConfig';
import { createLabelConfigService } from '../ads/labelConfigService';

declare const window: MoliRuntime.MoliWindow;

const moliConfig: MoliConfig | null = window.moli.getConfig();

if (moliConfig) {
  const extraLabels = (moliConfig.targeting && moliConfig.targeting.labels) ?? [];
  extraLabels.push(...window.moli.getRuntimeConfig().labels);
  const labelConfigService = createLabelConfigService(
    moliConfig.labelSizeConfig || [],
    extraLabels,
    window
  );

  const themingService = new ThemingService();

  // render the global config in a shadow root
  // create root container where react element will be inserted
  let container = document.createElement('div');
  container.classList.add('moli-console-container');

  // attach shadow DOM to container
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // function component to manage showOverlays state
  const DebugConsole = () => {
    const [showOverlays, setShowOverlays] = React.useState(false);
    const slotRoots = React.useRef(new Map<string, ReturnType<typeof createRoot>>());

    React.useEffect(() => {
      setTimeout(() => {
        const globalConfigComponentRoot = shadowRoot.getElementById('moli-console-global-config');
        themingService.setRootElement(globalConfigComponentRoot!);
        themingService.applyTheme();
        themingService.enableSystemThemeListener();
      }, 200);
    }, []);

    React.useEffect(() => {
      if (showOverlays) {
        moliConfig.slots.forEach(slot => {
          const slotDomElement = document.getElementById(slot.domId);
          if (slotDomElement && labelConfigService.filterSlot(slot)) {
            let slotConfigRoot = slotRoots.current.get(slot.domId);
            if (!slotConfigRoot) {
              slotConfigRoot = createRoot(slotDomElement);
              slotRoots.current.set(slot.domId, slotConfigRoot);
            }
            slotConfigRoot.render(
              <AdSlotConfig
                labelConfigService={labelConfigService}
                slot={slot}
                parentElement={slotDomElement}
              />
            );
          }
        });
      } else {
        // Unmount overlays when showOverlays is false
        slotRoots.current.forEach(root => {
          root.unmount();
        });
        slotRoots.current.clear();
      }
    }, [showOverlays]);

    return (
      <>
        <GlobalConfig
          config={moliConfig}
          runtimeConfig={window.moli.getRuntimeConfig()}
          modules={window.moli.getConfig()?.modules || {}}
          labelConfigService={labelConfigService}
          windowResizeService={new WindowResizeService()}
          themingService={themingService}
          showOverlays={showOverlays}
          onShowOverlaysChange={setShowOverlays}
        />
      </>
    );
  };

  // insert root container element in HTML DOM after the existing element
  window.document.body.append(container);

  // shadow DOM as react root
  const root = createRoot(shadowRoot);

  // render react element inside shadow DOM
  root.render(<DebugConsole />);
} else {
  window.alert('No moli config found. The console cannot be displayed');
}
