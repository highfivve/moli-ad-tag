import type { headerbidding } from '../../types/moliConfig';

export const extractPrebidAdSlotConfigs = (
  prebid: headerbidding.PrebidAdSlotConfigProvider
): headerbidding.PrebidAdSlotConfig[] => {
  return Array.isArray(prebid) ? prebid : [prebid];
};
