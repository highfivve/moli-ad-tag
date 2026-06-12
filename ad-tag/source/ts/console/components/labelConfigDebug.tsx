import React from 'react';

import { Tag, TagLabel } from './tag';
import { TagContainer } from './ui';
import type { sizeConfigs } from '../../types/moliConfig';

type ISLabelConfigProps = {
  labelSizeConfig: Array<sizeConfigs.LabelSizeConfigEntry>;
};

export const LabelConfigDebug: React.FC<ISLabelConfigProps> = ({ labelSizeConfig }) => {
  return (
    <div>
      {labelSizeConfig.map((labelSizeConfigEntry, idx) => {
        const mediaQueryMatches = window.matchMedia(labelSizeConfigEntry.mediaQuery).matches;
        return (
          <div key={idx} className="mb-2">
            Entry <strong>#{idx + 1}</strong>
            <TagContainer>
              <TagLabel>Media query</TagLabel>
              <Tag
                variant={mediaQueryMatches ? 'green' : 'red'}
                title={`Media query ${mediaQueryMatches ? 'matches' : "doesn't match"}`}
              >
                {labelSizeConfigEntry.mediaQuery}
              </Tag>
            </TagContainer>
            <TagContainer>
              <TagLabel>Supported labels</TagLabel>
              {labelSizeConfigEntry.labelsSupported.map(label => (
                <Tag key={label}>{label}</Tag>
              ))}
            </TagContainer>
          </div>
        );
      })}
    </div>
  );
};
