import { MoliRuntime } from 'ad-tag/source/ts/types/moliRuntime';
import { ModuleMeta, prebidjs } from '@highfivve/ad-tag';
import { AdReloadModuleConfig } from '@highfivve/module-moli-ad-reload';

import { Message } from '../components/globalConfig';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import React from 'react';
import { isNotNull } from '@highfivve/ad-tag/lib/util/arrayUtils';

const isWallpaperSlot = (
  slot: MoliRuntime.AdSlot,
  prebidConfigs: MoliRuntime.headerbidding.PrebidAdSlotConfig[]
): boolean => {
  const isFloorAd = slot.adUnitPath.includes('floor');
  const hasWallpaperInAdUnitPath = slot.adUnitPath.includes('wallpaper');
  const wallpaperSizes = new Set(['1x1', '1x2']);

  const hasOnlyWallpaperSizes = slot.sizes
    .map(size => (size === 'fluid' ? null : size.join('x')))
    .filter(isNotNull)
    .every(size => wallpaperSizes.has(size));

  const skinBidder = new Set([
    prebidjs.GumGum,
    prebidjs.DSPX,
    prebidjs.Visx,
    prebidjs.ImproveDigital
  ]);
  const hasOnlySkinBidders = prebidConfigs.every(
    prebidConfig =>
      prebidConfig.adUnit.bids.length > 0 &&
      prebidConfig.adUnit.bids.every(bid => skinBidder.has(bid.bidder ?? bid.module))
  );

  return hasWallpaperInAdUnitPath || hasOnlySkinBidders || (hasOnlyWallpaperSizes && !isFloorAd);
};

export const checkAdReloadConfig = (
  messages: Message[],
  modules: ModuleMeta[],
  slots: MoliRuntime.AdSlot[],
  labels: string[]
): void => {
  const module = modules.find(module => module.moduleType === 'ad-reload');

  if (!module) {
    return;
  }

  // this only works because there's a single ad reload module available right now
  const adReloadConfig = module.config as AdReloadModuleConfig;

  slots.forEach(slot => {
    if (!slot.prebid) {
      return;
    }
    const prebidConfigs = extractPrebidAdSlotConfigs(
      {
        keyValues: {},
        floorPrice: undefined,
        labels,
        isMobile: !labels.includes('desktop')
      },
      slot.prebid
    );

    // a wallpaper slot must be excluded from the ad reload
    if (
      isWallpaperSlot(slot, prebidConfigs) &&
      !adReloadConfig.excludeAdSlotDomIds.includes(slot.domId)
    ) {
      messages.push({
        kind: 'error',
        text: `Slot ${slot.domId} is a wallpaper ad unit and must be excluded from the ad reload`
      });
    }

    // oustream slots must be excluded from ad reload
    const isOutstreamSlot = prebidConfigs.some(prebid => prebid.adUnit.mediaTypes.video);
    if (isOutstreamSlot && !adReloadConfig.excludeAdSlotDomIds.includes(slot.domId)) {
      messages.push({
        kind: 'error',
        text: `Slot ${slot.domId} is an outstream ad unit and must be excluded from the ad reload`
      });
    }
  });
};
