import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { Message } from '../components/globalConfig';
import { ModuleMeta } from '@highfivve/ad-tag';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import React from 'react';

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

  if (module) {
    slots.filter(slot => {
      const reasons: string[] = [];

      if (slot.sizes.every(size => String(size) === '1,1' || String(size) === '1,2')) {
        reasons.push('has no appropriate sizes');
      }

      if (slot.adUnitPath.includes('wallpaper')) {
        reasons.push('has a wallpaper path');
      }

      if (slot.prebid) {
        const bidders = extractPrebidAdSlotConfigs(
          {
            keyValues: {},
            floorPrice: undefined,
            labels,
            isMobile: !labels.includes('desktop')
          },
          slot.prebid
        ).map(prebidConfig =>
          prebidConfig.adUnit.bids.every(b => b.bidder === 'dspx' || b.bidder === 'justpremium')
        );
        if (bidders[0]) {
          reasons.push('has only dspx and/or justpremium biders');
        }
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
