import React, { Component } from 'react';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';

import { MoliRuntime } from 'ad-tag/source/ts/types/moliRuntime';
import LabelSizeConfigEntry = MoliRuntime.LabelSizeConfigEntry;

type ISLabelConfigProps = {
  labelSizeConfig: Array<LabelSizeConfigEntry>;
};

type ISizeConfigState = {};

export class LabelConfigDebug extends Component<ISLabelConfigProps, ISizeConfigState> {
  render(): JSX.Element {
    const { labelSizeConfig } = this.props;
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
  }
}
