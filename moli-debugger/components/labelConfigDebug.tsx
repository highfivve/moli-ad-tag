import * as preact from 'preact';
import { JSX } from 'preact';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';

import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import LabelSizeConfigEntry = Moli.LabelSizeConfigEntry;

type ISLabelConfigProps = {
  labelSizeConfig: Array<LabelSizeConfigEntry>;
};

type ISizeConfigState = {};

export class LabelConfigDebug extends preact.Component<ISLabelConfigProps, ISizeConfigState> {
  render(props: ISLabelConfigProps, state: ISizeConfigState): JSX.Element {
    return (
      <div>
        {props.labelSizeConfig.map((labelSizeConfigEntry, idx) => {
          const mediaQueryMatches = window.matchMedia(labelSizeConfigEntry.mediaQuery).matches;
          return (
            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--noBorder">
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
                  <Tag>{label}</Tag>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
