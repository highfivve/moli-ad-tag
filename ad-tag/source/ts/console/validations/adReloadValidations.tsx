import { extractPrebidAdSlotConfigs } from '../util/prebid';
import type { AdSlot, headerbidding, modules } from '../../types/moliConfig';
import { prebidjs } from '../../types/prebidjs';
import { isNotNull } from '../../util/arrayUtils';
import { Message } from '../components/globalConfig';

const isWallpaperSlot = (
  slot: AdSlot,
  prebidConfigs: headerbidding.PrebidAdSlotConfig[]
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
  modules: modules.ModulesConfig | undefined,
  slots: AdSlot[],
  labels: string[]
): void => {
  const adReloadConfig = modules?.adReload;

  if (!adReloadConfig) {
    return;
  }

  slots.forEach(slot => {
    if (!slot.prebid) {
      return;
    }
    const prebidConfigs = extractPrebidAdSlotConfigs(slot.prebid);

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
