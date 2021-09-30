import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { ModuleMeta, prebidjs } from '@highfivve/ad-tag';

import { Message } from '../components/globalConfig';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import React from 'react';
import { isNotNull } from '@highfivve/ad-tag/lib/util/arrayUtils';

type ReloadIssuesType = {
  id: string;
  reasons: string[];
};

const isWallpaperSlot = (
  slot: Moli.AdSlot,
  labels: string[],
  prebidConfigs: Moli.headerbidding.PrebidAdSlotConfig[]
) => {
  const isFloorAd = slot.adUnitPath.includes('floor');
  const hasWallpaperInAdUnitPath = slot.adUnitPath.includes('wallpaper');
  const wallpaperSizes = new Set(['1x1', '1x2']);

  const hasOnlyWallpaperSizes = slot.sizes
    .map(size => (size === 'fluid' ? null : size.join('x')))
    .filter(isNotNull)
    .every(size => wallpaperSizes.has(size));

  const skinBidder = new Set([prebidjs.JustPremium, prebidjs.DSPX]);
  const hasOnlyDspxAndJustPremium = prebidConfigs.every(prebidConfig =>
    prebidConfig.adUnit.bids.every(bid => skinBidder.has(bid.bidder))
  );

  return (
    hasWallpaperInAdUnitPath || hasOnlyDspxAndJustPremium || (hasOnlyWallpaperSizes && !isFloorAd)
  );
};

export const checkAdReloadConfig = (
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
    const errors: string[] = [];
    let prebidConfigs: Moli.headerbidding.PrebidAdSlotConfig[] = [];
    if (slot.prebid) {
      prebidConfigs = extractPrebidAdSlotConfigs(
        {
          keyValues: {},
          floorPrice: undefined,
          labels,
          isMobile: !labels.includes('desktop')
        },
        slot.prebid
      );
    }

    if (!isWallpaperSlot(slot, labels, prebidConfigs)) {
      return;
    }
    if (slot.adUnitPath.includes('wallpaper_pixel')) {
      errors.push('Is a wallpaper pixel slot that should be excluded from reloading');
    }
    prebidConfigs.map(prebidConfig => {
      if (prebidConfig.adUnit.mediaTypes.video) {
        errors.push('Is an outstream slot that should be excluded from reloading');
      }
    });

    if (errors) {
      adReloadIssues.push({ id: slot.domId, reasons: errors });
    }
  });
  if (adReloadIssues.some(issue => issue.reasons.length)) {
    messages.push({
      kind: 'error',
      text: formatAdReloadConfigMsg(adReloadIssues)
    });
  }
  return adReloadIssues;
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
