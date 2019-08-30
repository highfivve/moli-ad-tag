import * as preact from 'preact';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';

import { Moli } from 'ad-tag';
import SizeConfigEntry = Moli.SizeConfigEntry;
import DfpSlotSize = Moli.DfpSlotSize;

type ISizeConfigProps = {
  sizeConfig: Array<SizeConfigEntry>;
};

type ISizeConfigState = {};

export class SizeConfigDebug extends preact.Component<ISizeConfigProps, ISizeConfigState> {
  render(props: ISizeConfigProps, state: ISizeConfigState): JSX.Element {
    return <div>
      {props.sizeConfig.map((sizeConfigEntry, idx) => {
          const mediaQueryMatches = window.matchMedia(sizeConfigEntry.mediaQuery).matches;
          return <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--noBorder">
            Entry <strong>#{idx + 1}</strong>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Media query</span>
              <div
                class={classList('MoliDebug-tag', [ mediaQueryMatches, 'MoliDebug-tag--green' ], [ !mediaQueryMatches, 'MoliDebug-tag--red' ])}
                title={`Media query ${mediaQueryMatches ? 'matches' : 'doesn\'t match'}`}>
                {sizeConfigEntry.mediaQuery}
              </div>
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Supported slot sizes</span>
              {sizeConfigEntry.sizesSupported.map(this.tagFromSlotSize)}
            </div>
          </div>;
        }
      )}
    </div>;
  }

  private tagFromSlotSize = (slotSize: DfpSlotSize): JSX.Element => {
    return <Tag>{slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`}</Tag>;
  };
}
