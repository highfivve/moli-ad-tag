import * as preact from 'preact';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';

import { classList } from '../util/stringUtils';

import { SizeConfigDebug } from './sizeConfigDebug';
import { Tag } from './tag';

import headerbidding = Moli.headerbidding;
import AdSlot = Moli.AdSlot;
import DfpSlotSize = Moli.DfpSlotSize;

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
  showSizeConfig: boolean;
};

const defaultPanelState: Pick<IAdSlotConfigState, 'showA9' | 'showPrebid' | 'showGeneral' | 'showSizeConfig'> = {
  showA9: false,
  showPrebid: false,
  showGeneral: false,
  showSizeConfig: false
};

type ValidatedSlotSize = { valid: boolean, size: DfpSlotSize };

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
    const slotVisible = !!document.getElementById(props.slot.domId)
      && props.sizeConfigService.filterSlot(props.slot);

    const prebidValid = this.isVisiblePrebid();
    const a9Valid = slotVisible && this.isVisibleA9();

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
                class={classList('MoliDebug-adSlot-button', [ state.showA9, 'is-active' ], [ a9Valid, 'is-rendered' ], [ !a9Valid, 'is-notRendered' ])}
                onClick={this.toggleA9}>A9</button>}
        {props.slot.prebid &&
        <button title="Show Prebid config"
                class={classList('MoliDebug-adSlot-button', [ state.showPrebid, 'is-active' ], [ prebidValid, 'is-rendered' ], [ !prebidValid, 'is-notRendered' ])}
                onClick={this.togglePrebid}>pb</button>}

        {props.slot.sizeConfig &&
        <button title="Show sizeConfig"
                class={classList('MoliDebug-adSlot-button', [ state.showSizeConfig, 'is-active' ])}
                onClick={this.toggleSizeConfig}>&#x1F4CF;</button>}
      </div>
      {state.showGeneral && <div class="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
        <div class="MoliDebug-tagContainer">
          <Tag variant="green">{props.slot.position}</Tag>
          <Tag variant="yellow">{props.slot.behaviour}</Tag>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class={classList('MoliDebug-tagLabel', [ slotVisible, 'MoliDebug-tag--greenText' ], [ !slotVisible, 'MoliDebug-tag--redText' ])}>
            DOM ID
          </span>
          <Tag variant={slotVisible ? 'green' : 'red'} title={`Slot ${slotVisible ? '' : 'not '}found in DOM`}>
            {props.slot.domId}
          </Tag>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">AdUnit path</span>
          <Tag>{props.slot.adUnitPath}</Tag>
        </div>
        {props.slot.sizes.length > 0 && <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">Sizes</span>
          {this.validateSlotSizes(props.slot.sizes).map(
            validatedSlotSize => this.tagFromValidatedSlotSize(validatedSlotSize, !!props.slot.sizeConfig)
          )}
        </div>}
        <div className="MoliDebug-tagContainer">
          {this.labelConfig(this.props.slot)}
        </div>
      </div>}
      {state.showA9 && props.slot.a9 && <div class="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
        {this.a9Config(props.slot.a9)}
      </div>}
      {state.showPrebid && props.slot.prebid && <div class="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
        {this.prebidConfig(props.slot.prebid)}
      </div>}
      {state.showSizeConfig && props.slot.sizeConfig &&
      <div className="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
        <SizeConfigDebug sizeConfig={props.slot.sizeConfig}/>
      </div>
      }
    </div>;
  }

  private prebidConfig = (prebid: headerbidding.PrebidAdSlotConfigProvider): JSX.Element => {
    const prebidAdUnit: prebidjs.IAdUnit = (this.isPrebidConfigObject(prebid) ? prebid : prebid({ keyValues: {} })).adUnit;
    const slotSizeConfig = this.props.slot.sizeConfig;
    const banner = prebidAdUnit.mediaTypes.banner;
    const video = prebidAdUnit.mediaTypes.video;

    return <div>
      <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Code</span>
        <Tag variant="green">{prebidAdUnit.code}</Tag>
      </div>
      {banner && <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Banner sizes</span>
        {this.validateSlotSizes(banner.sizes).map(validatedSlotSize =>
          this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
        )}
      </div>}
      {video && <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Video</span>
        <Tag variant="green">{video.context}</Tag>
        {this.validateSlotSizes(this.isSingleVideoSize(video.playerSize) ? [ video.playerSize ] : video.playerSize)
          .map(validatedSlotSize => this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig))
        }
      </div>}
      {prebidAdUnit.bids.map((bid: prebidjs.IBid, idx: number) => [
          <hr/>,
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Bidder #{idx + 1}</span>
            <Tag variant="blue">{bid.bidder}</Tag>
          </div>,
          <div className="MoliDebug-tagContainer">
            {this.labelConfig(bid)}
          </div>,
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Params</span>
            <Tag>{JSON.stringify(bid.params)}</Tag>
          </div>
        ]
      )}
    </div>;
  };

  private a9Config = (a9: headerbidding.A9AdSlotConfig): JSX.Element => {
    const slotSizeConfig = this.props.slot.sizeConfig;
    return <div>
      {<div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Sizes</span>
        {this.validateSlotSizes(this.props.slot.sizes.filter(this.isFixedSize)).map(validatedSlotSize =>
          this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
        )}
      </div>
      }
      <div class="MoliDebug-tagContainer">
        {this.labelConfig(a9)}
      </div>
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

  private toggleSizeConfig = (): void => {
    this.setState({ ...defaultPanelState, showSizeConfig: !this.state.showSizeConfig });
  };

  private isPrebidConfigObject = (prebid: headerbidding.PrebidAdSlotConfigProvider): prebid is headerbidding.PrebidAdSlotConfig => {
    return typeof prebid !== 'function';
  };

  private isVisiblePrebid = (): boolean => {
    const prebid = this.props.slot.prebid;

    if (prebid) {
      const prebidAdUnit: prebidjs.IAdUnit = this.isPrebidConfigObject(prebid) ? prebid.adUnit : prebid({ keyValues: {} }).adUnit;

      const video = prebidAdUnit.mediaTypes.video;
      const banner = prebidAdUnit.mediaTypes.banner;

      const videoValid = !!video && this.validateSlotSizes(
        this.isSingleVideoSize(video.playerSize) ? [ video.playerSize ] : video.playerSize
      ).some(validatedSlotSize => validatedSlotSize.valid);

      return videoValid || (!!banner && this.validateSlotSizes(banner.sizes)
        .some(validatedSlotSize => validatedSlotSize.valid));
    }

    return true;
  };

  private isVisibleA9 = (): boolean => {
    const a9 = this.props.slot.a9;

    if (a9) {
      const supportedLabels = this.props.sizeConfigService.getSupportedLabels();
      if (a9.labelAll) {
        return a9.labelAll.every(label => supportedLabels.indexOf(label) > -1);
      }
      if (a9.labelAny) {
        return a9.labelAny.some(label => supportedLabels.indexOf(label) > -1);
      }
    }

    return true;
  };

  private isSingleVideoSize = (playerSize: [ number, number ][] | [ number, number ]): playerSize is [ number, number ] => {
    return playerSize.length === 2 && typeof playerSize[0] === 'number' && typeof playerSize[1] === 'number';
  };

  private validateSlotSizes = (sizes: DfpSlotSize[]): ValidatedSlotSize[] => {
    const slotSizeConfig = this.props.slot.sizeConfig;
    const sizeConfigService = slotSizeConfig ?
      new SizeConfigService(slotSizeConfig, []) :
      this.props.sizeConfigService;

    return sizes.map(size => ({
      valid: sizeConfigService.filterSupportedSizes([ size ]).length > 0,
      size
    }));
  };

  private tagFromValidatedSlotSize = (slotSize: ValidatedSlotSize, hasSlotSizeConfig: boolean): JSX.Element => {
    return <Tag variant={slotSize.valid ? 'green' : 'red'}
                title={`${slotSize.valid ? 'Valid' : 'Invalid'} (${hasSlotSizeConfig ? 'slot' : 'global'} sizeConfig)`}>
      {slotSize.size === 'fluid' ? slotSize.size : `${slotSize.size[0]}x${slotSize.size[1]}`} {hasSlotSizeConfig ? 'Ⓢ' : 'Ⓖ'}
    </Tag>;
  };

  private isFixedSize(size: Moli.DfpSlotSize): size is [ number, number ] {
    return size !== 'fluid';
  }

  private labelConfig = (labelledSlot: {labelAll?: string[], labelAny?: string[]}): JSX.Element => {
    const labelAll = labelledSlot.labelAll;
    const labelAny = labelledSlot.labelAny;
    const supportedLabels = this.props.sizeConfigService.getSupportedLabels();
    const labelAllMatches = !!labelAll && labelAll.every(label => supportedLabels.indexOf(label) > -1);
    const labelAnyMatches = !!labelAny && labelAny.some(label => supportedLabels.indexOf(label) > -1);

    return <div>
      {labelAll && labelAll.length > 0 &&
      <div>
        <span className={classList('MoliDebug-tagLabel', [labelAllMatches, 'MoliDebug-tag--greenText'], [!labelAllMatches, 'MoliDebug-tag--redText'])}>labelAll</span>
        {labelAll.map(label => <Tag variant={supportedLabels.indexOf(label) > -1 ? 'green' : 'red'}>{label}</Tag>)}
      </div>
      }
      {labelAny && labelAny.length > 0 &&
      <div>
        <span className={classList('MoliDebug-tagLabel', [labelAnyMatches, 'MoliDebug-tag--greenText'], [!labelAnyMatches, 'MoliDebug-tag--redText'])}>labelAny</span>
        {labelAll && labelAll.length > 0 && <Tag variant={'yellow'}>labelAll was already evaluated, labelAny is ignored</Tag>}
        {labelAny.map(label => {
          const labelFound = supportedLabels.indexOf(label) > -1;
          return <Tag variant={labelFound ? 'green' : 'red'}>{label}</Tag>;
        })}
      </div>
      }
    </div>;
  };
}
