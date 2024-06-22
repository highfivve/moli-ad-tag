import React from 'react';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';
import type { GoogleAdManagerSlotSize, SizeConfigEntry } from '../../types/moliConfig';

type ISizeConfigProps = {
  sizeConfig: Array<SizeConfigEntry>;
  supportedLabels: Array<string>;
};

export const SizeConfigDebug: React.FC<ISizeConfigProps> = ({ sizeConfig, supportedLabels }) => {
  return (
    <div>
      {sizeConfig.map((sizeConfigEntry, idx) => {
        const mediaQueryMatches = window.matchMedia(sizeConfigEntry.mediaQuery).matches;

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
                {sizeConfigEntry.mediaQuery}
              </div>
            </div>
            {sizeConfigEntry.labelAll && (
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Label All</span>
                {sizeConfigEntry.labelAll.map(label => {
                  const labelMatches = supportedLabels.includes(label);
                  return (
                    <div
                      key={label}
                      className={classList(
                        'MoliDebug-tag',
                        [labelMatches, 'MoliDebug-tag--green'],
                        [!labelMatches, 'MoliDebug-tag--red']
                      )}
                      title={`Labels ${labelMatches ? 'match' : "don't match"}`}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
            {sizeConfigEntry.labelNone && (
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Label None</span>
                {sizeConfigEntry.labelNone.map(label => {
                  const labelMatches = supportedLabels.includes(label);
                  return (
                    <div
                      key={label}
                      className={classList(
                        'MoliDebug-tag',
                        [!labelMatches, 'MoliDebug-tag--green'],
                        [labelMatches, 'MoliDebug-tag--red']
                      )}
                      title={`Labels ${labelMatches ? 'match' : "don't match"}`}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Supported slot sizes</span>
              {sizeConfigEntry.sizesSupported.map((slotSize: GoogleAdManagerSlotSize) => {
                const sizeString =
                  slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`;
                return <Tag key={sizeString}>{sizeString}</Tag>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
