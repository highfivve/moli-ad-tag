import React, { Component, Fragment } from 'react';

import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import { SizeConfigService } from '@highfivve/ad-tag/source/ts/ads/sizeConfigService';

import { classList } from '../util/stringUtils';

import { SizeConfigDebug } from './sizeConfigDebug';
import { Tag } from './tag';

import headerbidding = Moli.headerbidding;
import AdSlot = Moli.AdSlot;
import DfpSlotSize = Moli.DfpSlotSize;
import { LabelConfigService } from '@highfivve/ad-tag/source/ts/ads/labelConfigService';
import { extractPrebidAdSlotConfigs } from '../util/prebid';

type IAdSlotConfigProps = {
  parentElement?: HTMLElement;
  slot: AdSlot;
  labelConfigService: LabelConfigService;
  /** required to find measurements for this slot */
  reportingConfig?: Moli.reporting.ReportingConfig;
};
type IAdSlotConfigState = {
  dimensions?: { width: number; height: number };
  showA9: boolean;
  showPrebid: boolean;
  showGeneral: boolean;
  showSizeConfig: boolean;
};

const defaultPanelState: Pick<
  IAdSlotConfigState,
  'showA9' | 'showPrebid' | 'showGeneral' | 'showSizeConfig'
> = {
  showA9: false,
  showPrebid: false,
  showGeneral: false,
  showSizeConfig: false
};

type ValidatedSlotSize = { valid: boolean; size: DfpSlotSize };

export class AdSlotConfig extends Component<IAdSlotConfigProps, IAdSlotConfigState> {
  constructor(props: IAdSlotConfigProps) {
    super(props);

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

  render(): JSX.Element {
    const { labelConfigService, slot, parentElement } = this.props;
    const { dimensions, showGeneral, showA9, showPrebid, showSizeConfig } = this.state;
    const slotValid =
      slot.behaviour.loaded === 'infinite' ? true : labelConfigService.filterSlot(slot);
    const slotElementExists = !!document.getElementById(slot.domId);

    const slotVisible = slotValid && slotElementExists;
    const isConfiguredInfiniteSlot = slot.behaviour.loaded === 'infinite' && !slotVisible;

    const prebidValid = this.isVisiblePrebid();
    const a9Valid = slotVisible && this.isVisibleA9();

    function setSlotVisibilityIcon(slotVisible: boolean, loadingBehaviour: string): string {
      if (slotVisible) {
        return '✔';
      } else if (isConfiguredInfiniteSlot) {
        return '?';
      } else {
        return 'x';
      }
    }

    return (
      <div
        className={classList(
          'MoliDebug-adSlot',
          [!!parentElement, 'MoliDebug-adSlot--overlay'],
          [!parentElement && slotVisible, 'is-rendered'],
          [!parentElement && !slotVisible, 'is-notRendered'],
          [isConfiguredInfiniteSlot, 'is-configuredInfinite']
        )}
        style={dimensions}
      >
        <div className="MoliDebug-adSlot-buttons">
          {!parentElement && (
            <button
              title={
                slot.behaviour.loaded === 'infinite'
                  ? `Configuration only used to copy on slots with infinite selector`
                  : `Slot ${slotVisible ? '' : 'not '}rendered`
              }
              className={classList(
                'MoliDebug-adSlot-button',
                [slotVisible, 'is-rendered'],
                [!slotVisible, 'is-notRendered'],
                [isConfiguredInfiniteSlot, 'is-configuredInfinite']
              )}
              onClick={this.toggleGeneral}
            >
              {setSlotVisibilityIcon(slotVisible, slot.behaviour.loaded)}
            </button>
          )}
          <button
            title="Show general slot info"
            className={classList('MoliDebug-adSlot-button', [showGeneral, 'is-active'])}
            onClick={this.toggleGeneral}
          >
            &#9432;
          </button>
          {slot.a9 && (
            <button
              title="Show A9 config"
              className={classList(
                'MoliDebug-adSlot-button',
                [showA9, 'is-active'],
                [a9Valid, 'is-rendered'],
                [!a9Valid, 'is-notRendered']
              )}
              onClick={this.toggleA9}
            >
              A9
            </button>
          )}
          {slot.prebid && (
            <button
              title="Show Prebid config"
              className={classList(
                'MoliDebug-adSlot-button',
                [showPrebid, 'is-active'],
                [prebidValid, 'is-rendered'],
                [!prebidValid, 'is-notRendered']
              )}
              onClick={this.togglePrebid}
            >
              pb
            </button>
          )}
          {slot.sizeConfig && (
            <button
              title="Show sizeConfig"
              className={classList(
                'MoliDebug-adSlot-button MoliDebug-adSlot-button--sizeConfig',
                [slotValid, 'is-rendered'],
                [!slotValid, 'is-notRendered'],
                [showSizeConfig, 'is-active']
              )}
              onClick={this.toggleSizeConfig}
            />
          )}
          {isConfiguredInfiniteSlot && (
            <p>{`Found ${
              window.document.querySelectorAll(slot.behaviour.selector).length
            } slots with infinite selector ${slot.behaviour.selector}`}</p>
          )}
        </div>
        {showGeneral && (
          <div className="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
            <div className="MoliDebug-tagContainer">
              <Tag variant="green">{slot.position}</Tag>
              <Tag variant="yellow">{slot.behaviour.loaded}</Tag>
              {slot.behaviour.bucket && <Tag variant="blue">{slot.behaviour.bucket}</Tag>}
            </div>
            <div className="MoliDebug-tagContainer">
              <span
                className={classList(
                  'MoliDebug-tagLabel',
                  [slotElementExists, 'MoliDebug-tag--greenText'],
                  [!slotElementExists, 'MoliDebug-tag--redText']
                )}
              >
                DOM ID
              </span>
              <Tag
                variant={slotElementExists ? 'green' : 'red'}
                title={`Slot ${slotElementExists ? '' : 'not '}found in DOM`}
              >
                {slot.domId}
              </Tag>
            </div>
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">AdUnit path</span>
              <Tag>{slot.adUnitPath}</Tag>
            </div>
            {slot.sizes.length > 0 && (
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Sizes</span>
                {this.validateSlotSizes(slot.sizes).map(validatedSlotSize =>
                  this.tagFromValidatedSlotSize(validatedSlotSize, !!slot.sizeConfig)
                )}
              </div>
            )}
            <div className="MoliDebug-tagContainer">{this.labelConfig(slot)}</div>
          </div>
        )}
        {showA9 && slot.a9 && (
          <div className="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
            {this.a9Config(slot.a9)}
          </div>
        )}
        {showPrebid && slot.prebid && (
          <div className="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
            {this.prebidConfig(slot.prebid)}
          </div>
        )}
        {showSizeConfig && slot.sizeConfig && (
          <div className="MoliDebug-panel MoliDebug-panel--blue MoliDebug-panel--collapsible">
            <SizeConfigDebug
              sizeConfig={slot.sizeConfig}
              supportedLabels={labelConfigService.getSupportedLabels()}
            />
          </div>
        )}
      </div>
    );
  }

  private prebidConfig = (prebid: headerbidding.PrebidAdSlotConfigProvider): JSX.Element => {
    const labels = this.props.labelConfigService.getSupportedLabels();
    const prebidAdUnits: prebidjs.IAdUnit[] = extractPrebidAdSlotConfigs(
      { keyValues: {}, floorPrice: undefined, labels, isMobile: !labels.includes('desktop') },
      prebid
    ).map(config => config.adUnit);

    const hasMultipleBids = prebidAdUnits.length > 1;

    const elements = prebidAdUnits.map((prebidAdUnit, index) => {
      const slotSizeConfig = this.props.slot.sizeConfig;
      const banner = prebidAdUnit.mediaTypes.banner;
      const video = prebidAdUnit.mediaTypes.video;
      const native = prebidAdUnit.mediaTypes.native;
      return (
        <div key={index}>
          {index > 0 && <hr />}
          {hasMultipleBids && <h5>{index + 1}. config</h5>}
          <div className="MoliDebug-tagContainer">
            <span className="MoliDebug-tagLabel">Code</span>
            <Tag variant="green">{prebidAdUnit.code || this.props.slot.domId}</Tag>
          </div>
          {banner && (
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Banner sizes</span>
              {this.validateSlotSizes(banner.sizes).map(validatedSlotSize =>
                this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
              )}
            </div>
          )}
          {video && (
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Video</span>
              <Tag variant="green">{video.context}</Tag>
              {!!video.playerSize &&
                this.validateSlotSizes(
                  this.isSingleVideoSize(video.playerSize) ? [video.playerSize] : video.playerSize
                ).map(validatedSlotSize =>
                  this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
                )}
            </div>
          )}
          {native && (
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">Native</span>
              <Tag variant="green">true</Tag>
            </div>
          )}
          {prebidAdUnit.bids.map((bid: prebidjs.IBid, idx: number) => (
            <Fragment key={idx}>
              <hr />
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Bidder #{idx + 1}</span>
                <Tag variant="blue">{bid.bidder ?? bid.module}</Tag>
              </div>
              <div className="MoliDebug-tagContainer">{this.labelConfig(bid)}</div>
              <div className="MoliDebug-tagContainer">
                <span className="MoliDebug-tagLabel">Params</span>
                <Tag>{JSON.stringify(bid.params)}</Tag>
              </div>
            </Fragment>
          ))}
        </div>
      );
    });

    if (elements.length === 1) {
      return elements[0];
    } else {
      return (
        <div>
          <h5>{elements.length} bid configurations</h5>
          {elements}
        </div>
      );
    }
  };

  private a9Config = (a9: headerbidding.A9AdSlotConfig): JSX.Element => {
    const slotSizeConfig = this.props.slot.sizeConfig;
    return (
      <div>
        {
          <div className="MoliDebug-tagContainer">
            <span className="MoliDebug-tagLabel">Sizes</span>
            {this.validateSlotSizes(this.props.slot.sizes.filter(AdSlotConfig.isFixedSize)).map(
              validatedSlotSize =>
                this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
            )}
          </div>
        }
        <div className="MoliDebug-tagContainer">{this.labelConfig(a9)}</div>
      </div>
    );
  };

  private toggleGeneral = (): void => this.setState({ showGeneral: !this.state.showGeneral });

  private toggleA9 = (): void => this.setState({ showA9: !this.state.showA9 });

  private togglePrebid = (): void => this.setState({ showPrebid: !this.state.showPrebid });

  private toggleSizeConfig = (): void =>
    this.setState({ showSizeConfig: !this.state.showSizeConfig });

  private isVisiblePrebid = (): boolean => {
    const prebid = this.props.slot.prebid;

    if (prebid) {
      const labels = this.props.labelConfigService.getSupportedLabels();
      return extractPrebidAdSlotConfigs(
        { keyValues: {}, floorPrice: undefined, labels, isMobile: !labels.includes('desktop') },
        prebid
      )
        .map(config => config.adUnit)
        .some(prebidAdUnit => {
          const video = prebidAdUnit.mediaTypes.video;
          const banner = prebidAdUnit.mediaTypes.banner;
          const native = prebidAdUnit.mediaTypes.native;

          const videoValid =
            !!video &&
            (!video.playerSize ||
              this.validateSlotSizes(
                this.isSingleVideoSize(video.playerSize) ? [video.playerSize] : video.playerSize
              ).some(validatedSlotSize => validatedSlotSize.valid));

          return (
            !!native ||
            videoValid ||
            (!!banner &&
              this.validateSlotSizes(banner.sizes).some(
                validatedSlotSize => validatedSlotSize.valid
              ))
          );
        });
    }

    return true;
  };

  private isVisibleA9 = (): boolean => {
    const a9 = this.props.slot.a9;

    if (a9) {
      const supportedLabels = this.props.labelConfigService.getSupportedLabels();
      if (a9.labelAll) {
        return a9.labelAll.every(label => supportedLabels.indexOf(label) > -1);
      }
      if (a9.labelAny) {
        return a9.labelAny.some(label => supportedLabels.indexOf(label) > -1);
      }
    }

    return true;
  };

  private isSingleVideoSize = (
    playerSize: [number, number][] | [number, number]
  ): playerSize is [number, number] => {
    return (
      playerSize.length === 2 &&
      typeof playerSize[0] === 'number' &&
      typeof playerSize[1] === 'number'
    );
  };

  private validateSlotSizes = (sizes: DfpSlotSize[]): ValidatedSlotSize[] => {
    const slotSizeConfig = this.props.slot.sizeConfig;
    const sizeConfigService = new SizeConfigService(
      slotSizeConfig,
      this.props.labelConfigService.getSupportedLabels(),
      window
    );

    return sizes.map(size => ({
      valid: sizeConfigService.filterSupportedSizes([size]).length > 0,
      size
    }));
  };

  private tagFromValidatedSlotSize = (
    slotSize: ValidatedSlotSize,
    hasSlotSizeConfig: boolean
  ): JSX.Element => {
    const sizeString =
      slotSize.size === 'fluid' ? slotSize.size : `${slotSize.size[0]}x${slotSize.size[1]}`;
    return (
      <Tag
        key={sizeString}
        variant={slotSize.valid ? 'green' : 'red'}
        title={`${slotSize.valid ? 'Valid' : 'Invalid'} (${
          hasSlotSizeConfig ? 'slot' : 'global'
        } sizeConfig)`}
      >
        {sizeString} {hasSlotSizeConfig ? 'Ⓢ' : 'Ⓖ'}
      </Tag>
    );
  };

  private static isFixedSize(size: Moli.DfpSlotSize): size is [number, number] {
    return size !== 'fluid';
  }

  private labelConfig = (labelledSlot: {
    labelAll?: string[];
    labelAny?: string[];
  }): JSX.Element => {
    const labelAll = labelledSlot.labelAll;
    const labelAny = labelledSlot.labelAny;
    const supportedLabels = this.props.labelConfigService.getSupportedLabels();
    const labelAllMatches =
      !!labelAll && labelAll.every(label => supportedLabels.indexOf(label) > -1);
    const labelAnyMatches =
      !!labelAny && labelAny.some(label => supportedLabels.indexOf(label) > -1);

    return (
      <div>
        {labelAll && labelAll.length > 0 && (
          <div>
            <span
              className={classList(
                'MoliDebug-tagLabel',
                [labelAllMatches, 'MoliDebug-tag--greenText'],
                [!labelAllMatches, 'MoliDebug-tag--redText']
              )}
            >
              labelAll
            </span>
            {labelAll.map(label => (
              <Tag key={label} variant={supportedLabels.indexOf(label) > -1 ? 'green' : 'red'}>
                {label}
              </Tag>
            ))}
          </div>
        )}
        {labelAny && labelAny.length > 0 && (
          <div>
            <span
              className={classList(
                'MoliDebug-tagLabel',
                [labelAnyMatches, 'MoliDebug-tag--greenText'],
                [!labelAnyMatches, 'MoliDebug-tag--redText']
              )}
            >
              labelAny
            </span>
            {labelAll && labelAll.length > 0 && (
              <Tag variant={'yellow'}>labelAll was already evaluated, labelAny is ignored</Tag>
            )}
            {labelAny.map(label => {
              const labelFound = supportedLabels.indexOf(label) > -1;
              return (
                <Tag key={label} variant={labelFound ? 'green' : 'red'}>
                  {label}
                </Tag>
              );
            })}
          </div>
        )}
      </div>
    );
  };
}
