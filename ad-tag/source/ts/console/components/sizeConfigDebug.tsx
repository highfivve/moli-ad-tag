import React from 'react';

import { Tag, TagLabel } from './tag';
import { TagContainer } from './ui';
import type { googleAdManager, sizeConfigs } from '../../types/moliConfig';

type ISizeConfigProps = {
  sizeConfig: Array<sizeConfigs.SizeConfigEntry>;
  supportedLabels: Array<string>;
};

export const SizeConfigDebug: React.FC<ISizeConfigProps> = ({ sizeConfig, supportedLabels }) => {
  return (
    <div>
      {sizeConfig.map((sizeConfigEntry, idx) => {
        const mediaQueryMatches = window.matchMedia(sizeConfigEntry.mediaQuery).matches;

        return (
          <div key={idx} className="mb-2">
            Entry <strong>#{idx + 1}</strong>
            <TagContainer>
              <TagLabel>Media query</TagLabel>
              <Tag
                variant={mediaQueryMatches ? 'green' : 'red'}
                title={`Media query ${mediaQueryMatches ? 'matches' : "doesn't match"}`}
              >
                {sizeConfigEntry.mediaQuery}
              </Tag>
            </TagContainer>
            {sizeConfigEntry.labelAll && (
              <TagContainer>
                <TagLabel>Label All</TagLabel>
                {sizeConfigEntry.labelAll.map(label => {
                  const labelMatches = supportedLabels.includes(label);
                  return (
                    <Tag
                      key={label}
                      variant={labelMatches ? 'green' : 'red'}
                      title={`Labels ${labelMatches ? 'match' : "don't match"}`}
                    >
                      {label}
                    </Tag>
                  );
                })}
              </TagContainer>
            )}
            {sizeConfigEntry.labelNone && (
              <TagContainer>
                <TagLabel>Label None</TagLabel>
                {sizeConfigEntry.labelNone.map(label => {
                  const labelMatches = supportedLabels.includes(label);
                  return (
                    <Tag
                      key={label}
                      variant={labelMatches ? 'red' : 'green'}
                      title={`Labels ${labelMatches ? 'match' : "don't match"}`}
                    >
                      {label}
                    </Tag>
                  );
                })}
              </TagContainer>
            )}
            <TagContainer>
              <TagLabel>Supported slot sizes</TagLabel>
              {sizeConfigEntry.sizesSupported.map((slotSize: googleAdManager.SlotSize) => {
                const sizeString =
                  slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`;
                return <Tag key={sizeString}>{sizeString}</Tag>;
              })}
            </TagContainer>
          </div>
        );
      })}
    </div>
  );
};
