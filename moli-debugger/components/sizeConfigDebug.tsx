import * as preact from 'preact';
import { JSX } from 'preact';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';

import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import SizeConfigEntry = Moli.SizeConfigEntry;
import DfpSlotSize = Moli.DfpSlotSize;

type ISizeConfigProps = {
  sizeConfig: Array<SizeConfigEntry>;
  supportedLabels: Array<string>;
};

type ISizeConfigState = {};

export class SizeConfigDebug extends preact.Component<ISizeConfigProps, ISizeConfigState> {
  render(props: ISizeConfigProps, state: ISizeConfigState): JSX.Element {
    return (
      <div>
        {props.sizeConfig.map((sizeConfigEntry, idx) => {
          const mediaQueryMatches = window.matchMedia(sizeConfigEntry.mediaQuery).matches;

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
                  {sizeConfigEntry.mediaQuery}
                </div>
              </div>
              {sizeConfigEntry.labelAll && (
                <div className="MoliDebug-tagContainer">
                  <span className="MoliDebug-tagLabel">Label All</span>
                  {sizeConfigEntry.labelAll.map(label => {
                    const labelMatches = props.supportedLabels.includes(label);
                    return (
                      <div
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
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Supported slot sizes</span>
                {sizeConfigEntry.sizesSupported.map(this.tagFromSlotSize)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  private tagFromSlotSize = (slotSize: DfpSlotSize): JSX.Element => {
    return <Tag>{slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`}</Tag>;
  };
}
