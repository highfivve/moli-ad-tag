import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { isNotNull, ModuleMeta } from '@highfivve/ad-tag';
import { SkinModuleConfig } from '@highfivve/module-generic-skin';
import React from 'react';
import { Message } from '../components/globalConfig';

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

const formatSkinConfigMsg = (
  skinAdSlot: AdSlotType,
  blockedAdSlotsIds: Array<string>,
  blockedAdSlotsBuckets: Array<string>
) => {
  return (
    <div>
      The SkinAdSlot <strong>{skinAdSlot.id}</strong> in the bucket{' '}
      <strong>{skinAdSlot.bucket}</strong> is not in the same bucket with the BlockedAdSlots:
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
