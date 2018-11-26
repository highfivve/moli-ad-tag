import * as preact from 'preact';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';

import { classList } from '../util/stringUtils';

import AdSlot = Moli.AdSlot;
import headerbidding = Moli.headerbidding;

type IAdSlotConfigProps = {
  parentElement?: HTMLElement;
  slot: AdSlot;
  sizeConfigService: SizeConfigService;
};
type IAdSlotConfigState = {
  dimensions?: { width: number, height: number };
  showA9: boolean;
  showPrebid: boolean;
  showGeneral: boolean;
};

const defaultPanelState: Pick<IAdSlotConfigState, 'showA9' | 'showPrebid' | 'showGeneral'> = {
  showA9: false,
  showPrebid: false,
  showGeneral: false
};

export class AdSlotConfig extends preact.Component<IAdSlotConfigProps, IAdSlotConfigState> {

  constructor(props: IAdSlotConfigProps) {
    super();

    if (props.parentElement) {
      props.parentElement.classList.add('MoliDebug-posRelative');

      const { width, height } = props.parentElement.getBoundingClientRect();
      this.state = {
        dimensions: { width, height },
        ...defaultPanelState
      };
    } else {
      this.state = defaultPanelState;
    }
  }

  render(props: IAdSlotConfigProps, state: IAdSlotConfigState): JSX.Element {
    const slotVisible = !!document.getElementById(props.slot.domId) && props.sizeConfigService.filterSlot(props.slot);

    return <div class={classList('MoliDebug-adSlot', [ !!props.parentElement, 'MoliDebug-adSlot--overlay' ])}
                style={state.dimensions}>
      <div class="MoliDebug-adSlot-buttons">
        {!props.parentElement &&
        <button title={`Slot ${slotVisible ? '' : 'not '}rendered`}
                class={classList('MoliDebug-adSlot-button', [ slotVisible, 'is-rendered' ], [ !slotVisible, 'is-notRendered' ])}
                onClick={this.toggleGeneral}>{slotVisible ? '✔' : '×'}</button>
        }
        <button title="Show general slot info"
                class={classList('MoliDebug-adSlot-button', [ state.showGeneral, 'is-active' ])}
                onClick={this.toggleGeneral}>&#9432;</button>
        {props.slot.a9 &&
        <button title="Show A9 config"
                class={classList('MoliDebug-adSlot-button', [ state.showA9, 'is-active' ])}
                onClick={this.toggleA9}>A9</button>}
        {props.slot.prebid &&
        <button title="Show Prebid config"
                class={classList('MoliDebug-adSlot-button', [ state.showPrebid, 'is-active' ])}
                onClick={this.togglePrebid}>pb</button>}
      </div>
      {state.showGeneral && <div class="MoliDebug-panel">
        <div class="MoliDebug-tagContainer">
          <div class="MoliDebug-tag MoliDebug-tag--green">{props.slot.position}</div>
          <div class="MoliDebug-tag MoliDebug-tag--yellow">{props.slot.behaviour}</div>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">DOM ID</span>
          <div class="MoliDebug-tag">{props.slot.domId}</div>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">AdUnit path</span>
          <div class="MoliDebug-tag">{props.slot.adUnitPath}</div>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">Sizes</span>
          {props.slot.sizes.map(size => {
              const slotSizeValid = props.sizeConfigService.filterSupportedSizes([ size ]).length > 0;
              return <div class={classList('MoliDebug-tag', [ !slotSizeValid, 'MoliDebug-tag--red' ])}
                          title={`${slotSizeValid ? 'Valid' : 'Invalid'} slot size as per configuration`}>
                {size === 'fluid' ? size : `${size[0]}x${size[1]}`}
              </div>;
            }
          )}
        </div>
      </div>}
      {state.showA9 && <div class="MoliDebug-panel">
        A9 is <div class="MoliDebug-tag MoliDebug-tag--green">enabled</div>
      </div>}
      {state.showPrebid && props.slot.prebid && <div class="MoliDebug-panel">
        {this.prebidConfig(props.slot.prebid)}
      </div>}
    </div>;
  }

  private prebidConfig = (prebid: headerbidding.PrebidAdSlotConfigProvider): JSX.Element => {
    const prebidAdUnit: prebidjs.IAdUnit = (this.isPrebidConfigObject(prebid) ? prebid : prebid({ keyValues: {} })).adUnit;
    const banner = prebidAdUnit.mediaTypes.banner;
    const video = prebidAdUnit.mediaTypes.video;

    return <div>
      <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Code</span>
        <div class="MoliDebug-tag MoliDebug-tag--green">{prebidAdUnit.code}</div>
      </div>
      {banner && <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Banner sizes</span>
        {banner.sizes.map(size =>
          <div class="MoliDebug-tag">
            {`${size[0]}x${size[1]}`}
          </div>)}
      </div>}
      {video && <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Video</span>
        <div class="MoliDebug-tag MoliDebug-tag--green">{video.context}</div>
        {this.isSingleVideoSize(video.playerSize) && this.tagFromTuple(video.playerSize)}
        {this.isMultiVideoSize(video.playerSize) && video.playerSize.map(
          (size: [ number, number ]) => this.tagFromTuple(size))
        }
      </div>}
      {prebidAdUnit.bids.map((bid: prebidjs.IBid, idx: number) => [
          <hr/>,
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Bidder #{idx + 1}</span>
            <div class="MoliDebug-tag MoliDebug-tag--red">{bid.bidder}</div>
          </div>,
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Params</span>
            <div class="MoliDebug-tag">{JSON.stringify(bid.params)}</div>
          </div>
        ]
      )}
    </div>;
  };

  private toggleGeneral = (): void => {
    this.setState({ ...defaultPanelState, showGeneral: !this.state.showGeneral });
  };

  private toggleA9 = (): void => {
    this.setState({ ...defaultPanelState, showA9: !this.state.showA9 });
  };

  private togglePrebid = (): void => {
    this.setState({ ...defaultPanelState, showPrebid: !this.state.showPrebid });
  };

  private tagFromTuple = (tuple: [ number, number ]): JSX.Element => {
    return <div class="MoliDebug-tag">{`${tuple[0]}x${tuple[1]}`}</div>;
  };

  private isPrebidConfigObject = (prebid: Moli.headerbidding.PrebidAdSlotConfigProvider): prebid is headerbidding.PrebidAdSlotConfig => {
    return typeof prebid !== 'function';
  };

  private isSingleVideoSize = (playerSize: [ number, number ][] | [ number, number ]): playerSize is [ number, number ] => {
    return typeof playerSize[0] === 'number';
  };

  private isMultiVideoSize = (playerSize: [ number, number ][] | [ number, number ]): playerSize is [ number, number ][] => {
    return Array.isArray(playerSize[0]);
  };
}
