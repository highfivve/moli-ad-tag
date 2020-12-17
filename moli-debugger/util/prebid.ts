import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';

export const extractPrebidAdSlotConfigs = (
  context: Moli.headerbidding.PrebidAdSlotContext,
  prebid: Moli.headerbidding.PrebidAdSlotConfigProvider
): Moli.headerbidding.PrebidAdSlotConfig[] => {
  if (typeof prebid === 'function') {
    const oneOrMoreConfigs = prebid(context);
    return Array.isArray(oneOrMoreConfigs) ? oneOrMoreConfigs : [oneOrMoreConfigs];
  } else {
    return Array.isArray(prebid) ? prebid : [prebid];
  }
};
