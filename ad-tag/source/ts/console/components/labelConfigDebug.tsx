import React from 'react';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';
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
          <div key={idx} className="MoliDebug-sidebarSection MoliDebug-sidebarSection--noBorder">
            Entry <strong>#{idx + 1}</strong>
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Media query</span>
              <div
                className={classList(
                  'MoliDebug-tag',
                  [mediaQueryMatches, 'MoliDebug-tag--green'],
                  [!mediaQueryMatches, 'MoliDebug-tag--red']
                )}
                title={`Media query ${mediaQueryMatches ? 'matches' : "doesn't match"}`}
              >
                {labelSizeConfigEntry.mediaQuery}
              </div>
            </div>
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Supported labels</span>
              {labelSizeConfigEntry.labelsSupported.map(label => (
                <Tag key={label}>{label}</Tag>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
