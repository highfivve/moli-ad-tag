import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { Message } from '../components/globalConfig';
import { ModuleMeta } from '@highfivve/ad-tag';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import React from 'react';
import { AdReloadModuleConfig } from '@highfivve/module-moli-ad-reload';

type ReloadIssuesType = {
  id: string;
  reasons: string[];
};

const checkAdReloadConfig = (
  messages: Message[],
  modules: ModuleMeta[],
  slots: Moli.AdSlot[],
  labels: string[]
) => {
  const module = modules.find(module => module.name === 'moli-ad-reload');
  const adReloadIssues: ReloadIssuesType[] = [];

  if (!module) {
    return;
  }

  slots.forEach(slot => {
    const reasons: string[] = [];

    const adReloadConfig = module.config as AdReloadModuleConfig;
    const wallpaperSlot = slot.adUnitPath.includes('wallpaper') ? slot : null;

    if (wallpaperSlot) {
      if (!adReloadConfig.excludeAdSlotDomIds.some(slotId => wallpaperSlot.domId === slotId)) {
        reasons.push(
          "Ad unit contains a wallpaper path and it's not excluded in the adReload config"
        );
      }

      // Check wallpaper sizes
      const wallpaperSizes = new Set(['1x1', '1x2']);
      if (
        slot.sizes
          .map(size => (size === 'fluid' ? size : size.join('x')))
          .every(size => wallpaperSizes.has(size))
      ) {
        reasons.push('Has no appropriate sizes (i.e., only [1x1] and/or [1x2])');
      }
    }

    if (slot.prebid) {
      const prebidConfig = extractPrebidAdSlotConfigs(
        {
          keyValues: {},
          floorPrice: undefined,
          labels,
          isMobile: !labels.includes('desktop')
        },
        slot.prebid
      );

      // Check for dsps and justPremium
      const certainBiddersSet = new Set(['dspx', 'justpremium']);
      const bidders = prebidConfig.map(prebidConfig =>
        prebidConfig.adUnit.bids.every(bid => certainBiddersSet.has(bid.bidder))
      );

      if (bidders[0]) {
        reasons.push('Has only dspx and/or justpremium bidders');
      }

      // Check if outstream slot
      prebidConfig.map(prebidConfig => {
        if (prebidConfig.adUnit.mediaTypes.video) {
          reasons.push('Is an outstream slot that should be excluded from reloading');
        }
      });
    }
    if (reasons) {
      adReloadIssues.push({ id: slot.domId, reasons: reasons });
    }
  });

  if (adReloadIssues.some(issue => issue.reasons.length)) {
    messages.push({
      kind: 'error',
      text: formatAdReloadConfigMsg(adReloadIssues)
    });
  }
};

const formatAdReloadConfigMsg = issues => {
  return (
    <div>
      AdReload should be disabled for the following reasons:
      {issues.map((issue, index) => {
        return (
          issue.reasons.length > 0 && (
            <div key={index}>
              The {issue.id} slot:
              <ul>
                {issue.reasons.map((issue, index) => {
                  return <li key={index}>{issue}</li>;
                })}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
};

export default checkAdReloadConfig;
