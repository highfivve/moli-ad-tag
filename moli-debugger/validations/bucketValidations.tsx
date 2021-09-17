import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { isNotNull, ModuleMeta } from '@highfivve/ad-tag';
import { SkinModuleConfig } from '@highfivve/module-generic-skin';
import React from 'react';
import { Message } from '../components/globalConfig';
import { extractPrebidAdSlotConfigs } from '../util/prebid';

type AdSlotType = {
  id: string;
  bucket: string;
};

export const checkBucketConfig = (
  messages: Message[],
  bucket: Moli.bucket.BucketConfig,
  slots: Moli.AdSlot[]
) => {
  const hasBucket = slots.some(slot => !!slot.behaviour.bucket);
  const slotsWithoutBucket = slots.filter(slot => !slot.behaviour.bucket);

  if (!hasBucket && bucket.enabled) {
    messages.push({
      kind: 'error',
      text: 'Buckets are enabled in the config, but there are no ad units that have a bucket defined!'
    });
  }

  if (slotsWithoutBucket) {
    messages.push({
      kind: 'warning',
      text: formatMissingBucketsMsg(slotsWithoutBucket)
    });
  }

  if (hasBucket && !bucket.enabled) {
    messages.push({
      kind: 'error',
      text: 'Buckets are configured for ad slots, but buckets are disabled in the config!'
    });
  } else if (!bucket.enabled) {
    messages.push({
      kind: 'optimization',
      text: 'Buckets are disabled!'
    });
  }
};

export const checkSkinConfig = (
  messages: Message[],
  modules: ModuleMeta[],
  slots: Moli.AdSlot[]
) => {
  const module = modules.find(module => module.name === 'skin');

  if (module) {
    const skinModule = module.config as unknown as SkinModuleConfig;
    skinModule.configs.forEach(conf => {
      const skinAdSlotDomId = conf.skinAdSlotDomId;
      const blockedAdSlotDomIds = conf.blockedAdSlotDomIds;

      const skinAdSlotBucket = slots.find(slot => slot.domId === skinAdSlotDomId)?.behaviour.bucket;
      const blockedAdBuckets: string[] = blockedAdSlotDomIds
        .map(slotId => slots.find(slot => slot.domId === slotId)?.behaviour.bucket)
        .filter(isNotNull);

      if (skinAdSlotBucket) {
        const areAllInTheSameBucket = new Set([...blockedAdBuckets, skinAdSlotBucket]).size === 1;
        if (!areAllInTheSameBucket) {
          messages.push({
            kind: 'error',
            text: formatSkinConfigMsg(
              {
                id: skinAdSlotDomId,
                bucket: skinAdSlotBucket
              },
              blockedAdSlotDomIds,
              blockedAdBuckets
            )
          });
        }
      }
    });
  }
};

export const checkAdReloadConfig = (
  messages: Message[],
  modules: ModuleMeta[],
  slots: Moli.AdSlot[],
  labels
) => {
  const module = modules.find(module => module.name === 'moli-ad-reload');
  type ReloadIssuesType = {
    id: string;
    reasons: string[];
  };
  let adReloadIssues: ReloadIssuesType[] = [{ id: '', reasons: [] }];

  if (module) {
    slots.filter((slot, index) => {
      if (
        slot.sizes
          .filter(size => size !== 'fluid')
          .every(size => String(size) === '1,1' || String(size) === '1,2')
      ) {
        adReloadIssues[index].id = slot.domId;
        adReloadIssues[index].reasons.push('has no appropriate sizes');
      }

      if (slot.adUnitPath.includes('wallpaper')) {
        adReloadIssues[index].id = slot.domId;
        adReloadIssues[index].reasons.push('has a wallpaper path');
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
          adReloadIssues[index].id = slot.domId;
          adReloadIssues[index].reasons.push('has only dspx and/or justpremium biders');
        }
      }
      adReloadIssues.push({ id: '', reasons: [] });
    });

    if (adReloadIssues.length) {
      messages.push({
        kind: 'error',
        text: formatAdReloadConfigMsg(adReloadIssues.filter(issue => issue.id !== ''))
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
          <div key={index}>
            The {issue.id}:
            <ul>
              {issue.reasons.map((issue, index) => {
                return <li key={index}>{issue}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const formatSkinConfigMsg = (
  skinAdSlot: AdSlotType,
  blockedAdSlotsIds: Array<string>,
  blockedAdSlotsBuckets: Array<string>
) => {
  return (
    <div>
      {`The SkinAdSlot ${skinAdSlot.id} in the bucket ${skinAdSlot.bucket} is not in the same bucket with the BlockedAdSlots:`}
      <ul>
        {blockedAdSlotsIds.map((id, index) => {
          return <li key={index}>{`${id}: ${blockedAdSlotsBuckets[index]}`}</li>;
        })}
      </ul>
    </div>
  );
};

const formatMissingBucketsMsg = (slots: Moli.AdSlot[]) => {
  return (
    <div>
      {`The following slots might require defined buckets:`}
      <ul>
        {slots.map((slot, index) => {
          return <li key={index}>{slot.domId}</li>;
        })}
      </ul>
    </div>
  );
};
