import { MoliRuntime } from 'ad-tag/source/ts/types/moliRuntime';

export const extractPrebidAdSlotConfigs = (
  context: MoliRuntime.headerbidding.PrebidAdSlotContext,
  prebid: MoliRuntime.headerbidding.PrebidAdSlotConfigProvider
): MoliRuntime.headerbidding.PrebidAdSlotConfig[] => {
  if (typeof prebid === 'function') {
    const oneOrMoreConfigs = prebid(context);
    return Array.isArray(oneOrMoreConfigs) ? oneOrMoreConfigs : [oneOrMoreConfigs];
  } else {
    return Array.isArray(prebid) ? prebid : [prebid];
  }
};
