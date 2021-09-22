import { Message } from '../components/globalConfig';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import React from 'react';
import { flatten } from '@highfivve/ad-tag';
import { extractPrebidAdSlotConfigs } from '../util/prebid';

type MissingSizesType = {
  slotId: string;
  unsupportedSizes?: string[];
  bannerSizes?: string[];
  unusedSupportedSizes?: string[];
};

export const checkSizesConfig = (messages: Message[], slots: Moli.AdSlot[], labels: string[]) => {
  const missingSizesInSlots: MissingSizesType[] = [];
  slots.map(slot => {
    const supportedSizesAsString: string[] = flatten(
      slot.sizeConfig.map(sizeConfigEntry =>
        sizeConfigEntry.sizesSupported.map(dfpSlotSize =>
          dfpSlotSize === 'fluid' ? dfpSlotSize : dfpSlotSize.join('x')
        )
      )
    );
    const supportedSizesSet = new Set(supportedSizesAsString);
    const sizesInSlot = slot.sizes.map(size => (size === 'fluid' ? size : size.join('x')));
    const sizesInSlotSet = new Set(sizesInSlot);

    const unsupportedSizes: string[] = sizesInSlot.filter(size => !supportedSizesSet.has(size));
    missingSizesInSlots.push({ slotId: slot.domId, unsupportedSizes: unsupportedSizes });

    // Unused supported sizes
    const unusedSupportedSizes: string[] = supportedSizesAsString.filter(
      size => !sizesInSlotSet.has(size)
    );

    const existingSlot = missingSizesInSlots.find(missingSize => missingSize.slotId === slot.domId);
    if (existingSlot) {
      existingSlot.unusedSupportedSizes = unusedSupportedSizes;
    } else {
      missingSizesInSlots.push({
        slotId: slot.domId,
        unusedSupportedSizes: unusedSupportedSizes
      });
    }

    // Prebid config
    if (slot.prebid) {
      const missingBannerSizes: string[] = [];
      const bannerSizes = extractPrebidAdSlotConfigs(
        {
          keyValues: {},
          floorPrice: undefined,
          labels,
          isMobile: !labels.includes('desktop')
        },
        slot.prebid
      ).map(prebid => prebid.adUnit?.mediaTypes.banner?.sizes);

      bannerSizes.map(bannerSize => {
        bannerSize?.map(value => {
          const bannerSizeString = value.join('x');
          if (!sizesInSlotSet.has(bannerSizeString)) {
            missingBannerSizes.push(bannerSizeString);
          }
        });
      });

      const existingSlot = missingSizesInSlots.find(
        missingSize => missingSize.slotId === slot.domId
      );
      if (existingSlot) {
        existingSlot.bannerSizes = missingBannerSizes;
      } else {
        missingSizesInSlots.push({
          slotId: slot.domId,
          bannerSizes: missingBannerSizes
        });
      }
    }
  });

  if (
    missingSizesInSlots.some(
      ms =>
        ms.unsupportedSizes?.some(s => s.length) ||
        ms.bannerSizes?.some(s => s.length) ||
        ms.unusedSupportedSizes?.some(s => s.length)
    )
  ) {
    messages.push({
      kind: 'error',
      text: formatSizesConfigMsg(missingSizesInSlots)
    });
  }
};

const formatSizesConfigMsg = (missingSizes: MissingSizesType[]) => {
  const formatTableRow = (sizes: string[] | undefined) => {
    if (!sizes) {
      return;
    }
    return sizes.map((size, index) => {
      if (sizes.length === 1) {
        return size !== 'fluid' ? `[${size}]` : size;
      } else if (index === 0) {
        return size !== 'fluid' ? `[${size}],` : 'fluid,';
      } else if (index === sizes.length - 1) {
        return size !== 'fluid' ? ` [${size}]` : 'fluid';
      } else {
        return size !== 'fluid' ? ` [${size}],` : ' fluid,';
      }
    });
  };

  return (
    <div>
      The following slots have sizes that need to be supported/defined:
      <table className={'size-valid-table'}>
        <thead>
          <tr>
            <th>Slot ID</th>
            <th>Unsupported sizes</th>
            <th>Undefined banned sizes</th>
            <th>Unused supported sizes</th>
          </tr>
        </thead>
        <tbody>
          {missingSizes.map((row, index) => {
            if (
              !row.unsupportedSizes?.length &&
              !row.bannerSizes?.length &&
              !row.unusedSupportedSizes?.length
            ) {
              return null;
            }
            return (
              <tr key={index}>
                <td>{row.slotId}</td>
                <td>{formatTableRow(row.unsupportedSizes)}</td>
                <td>{formatTableRow(row.bannerSizes)}</td>
                <td>{formatTableRow(row.unusedSupportedSizes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
