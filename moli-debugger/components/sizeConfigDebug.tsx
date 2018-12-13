import * as preact from 'preact';

import { Tag } from './tag';
import { classList } from '../util/stringUtils';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import SizeConfigEntry = Moli.SizeConfigEntry;
import SlotSizeConfigEntry = Moli.SlotSizeConfigEntry;
import DfpSlotSize = Moli.DfpSlotSize;

type ISizeConfigProps = {
  sizeConfig: Array<SizeConfigEntry | SlotSizeConfigEntry>;
};

type ISizeConfigState = {};

export class SizeConfigDebug extends preact.Component<ISizeConfigProps, ISizeConfigState> {
  render(props: ISizeConfigProps, state: ISizeConfigState): JSX.Element {
    return <div>
      {props.sizeConfig.map((sizeConfigEntry, idx) => {
          const mediaQueryMatches = window.matchMedia(sizeConfigEntry.mediaQuery).matches;
          return <div class="MoliDebug-sidebarSection">
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
            {this.isGlobalSizeConfigEntry(sizeConfigEntry) &&
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Labels</span>
              {sizeConfigEntry.labels.map(label => <Tag>{label}</Tag>)}
            </div>}
          </div>;
        }
      )}
    </div>;
  }

  private isGlobalSizeConfigEntry(entry: SizeConfigEntry | SlotSizeConfigEntry): entry is SizeConfigEntry {
    return entry.hasOwnProperty('labels');
  }

  private tagFromSlotSize = (slotSize: DfpSlotSize): JSX.Element => {
    return <Tag>{slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`}</Tag>;
  };
}
