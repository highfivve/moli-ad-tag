import React, { Fragment } from 'react';

import { classList } from '../util/stringUtils';

import { SizeConfigDebug } from './sizeConfigDebug';
import { Tag } from './tag';
import { SubHeadline, Tabs } from './ui';

import { extractPrebidAdSlotConfigs } from '../util/prebid';
import { AdSlot, bucket, googleAdManager, headerbidding } from '../../types/moliConfig';
import { LabelConfigService } from '../../ads/labelConfigService';
import { SizeConfigService } from '../../ads/sizeConfigService';
import { prebidjs } from '../../types/prebidjs';

type IAdSlotConfigProps = {
  parentElement?: HTMLElement;
  slot: AdSlot;
  labelConfigService: LabelConfigService;
  /** open the slot card right away, e.g. when linked from the overview tab */
  initiallyExpanded?: boolean;
};

type SlotTab = 'overview' | 'sizeConfig' | 'bidders';

type IAdSlotConfigState = {
  dimensions?: { width: number; height: number };
  expanded: boolean;
  activeTab: SlotTab;
};

type ValidatedSlotSize = { valid: boolean; size: googleAdManager.SlotSize };

export class AdSlotConfig extends React.Component<IAdSlotConfigProps, IAdSlotConfigState> {
  constructor(props: IAdSlotConfigProps) {
    super(props);

    const initialState = {
      expanded: !!props.initiallyExpanded,
      activeTab: 'overview' as const
    };

    if (props.parentElement) {
      props.parentElement.classList.add('relative');

      const { width, height } = props.parentElement.getBoundingClientRect();
      this.state = {
        dimensions: { width, height },
        ...initialState
      };
    } else {
      this.state = initialState;
    }
  }

  render(): React.ReactNode {
    const { labelConfigService, slot, parentElement } = this.props;
    const { dimensions, expanded, activeTab } = this.state;
    const slotValid =
      slot.behaviour.loaded === 'infinite' ? true : labelConfigService.filterSlot(slot);
    const slotElementExists = !!document.getElementById(slot.domId);

    const slotVisible = slotValid && slotElementExists;
    const isConfiguredInfiniteSlot = slot.behaviour.loaded === 'infinite' && !slotVisible;

    const getBucketName = (bucket?: bucket.AdSlotBucket): string => {
      if (!bucket) {
        return 'default';
      }
      if (typeof bucket === 'string') {
        return bucket;
      }
      return bucket[labelConfigService.getDeviceLabel()] ?? 'default';
    };

    const tabItems: ReadonlyArray<{ id: SlotTab; label: React.ReactNode }> = [
      { id: 'overview', label: 'Overview' },
      ...(slot.sizeConfig ? [{ id: 'sizeConfig' as const, label: 'Size Configs' }] : []),
      ...(slot.prebid || slot.a9 ? [{ id: 'bidders' as const, label: 'Bidder Params' }] : [])
    ];

    return (
      <div
        className={classList('d-collapse d-collapse-arrow mb-2 rounded-md bg-base-200', [
          !!parentElement,
          'absolute left-0 top-0 z-[99999998] h-full min-h-[100px] w-full min-w-[300px] overflow-y-auto border border-solid border-base-300 bg-base-100/90'
        ])}
        style={dimensions}
      >
        <input
          type="checkbox"
          checked={expanded}
          onChange={() => this.setState({ expanded: !expanded })}
          aria-label={`toggle slot ${slot.domId}`}
        />
        <div className="d-collapse-title flex min-h-0 flex-wrap items-center gap-1 py-2 text-sm font-semibold">
          <span className="break-all">{slot.domId}</span>
          <Tag variant="transparent">{slot.behaviour.loaded}</Tag>
          {slotVisible && (
            <Tag variant="secondary" title="Slot rendered">
              ✔ requested
            </Tag>
          )}
          {!slotVisible && !isConfiguredInfiniteSlot && (
            <Tag variant="red" title="Slot not rendered">
              ✖ not requested
            </Tag>
          )}
          {isConfiguredInfiniteSlot && (
            <Tag
              variant="yellow"
              title="Configuration only used to copy on slots with infinite selector"
            >
              ? infinite
            </Tag>
          )}
          {slot.sizeConfig && (
            <Tag
              variant={slotValid ? 'secondary' : 'red'}
              title={`Slot sizeConfig ${slotValid ? 'matches' : 'does not match'}`}
            >
              📐
            </Tag>
          )}
        </div>
        <div className="d-collapse-content text-sm">
          <Tabs<SlotTab>
            tabs={tabItems}
            active={activeTab}
            onSelect={tab => this.setState({ activeTab: tab })}
            className="mb-2"
          />
          {activeTab === 'overview' && (
            <div>
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                <Tag variant="green">{slot.position}</Tag>
                <Tag variant="yellow">{slot.behaviour.loaded}</Tag>
                {slot.behaviour.bucket && (
                  <Tag variant="blue">{getBucketName(slot.behaviour.bucket)}</Tag>
                )}
              </div>
              {isConfiguredInfiniteSlot && (
                <p className="mt-2">Looking up infinite slots is currently not implemented</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                <span
                  className={classList(
                    'inline-block min-w-36 max-w-96 pr-1 font-medium',
                    [slotElementExists, 'text-success'],
                    [!slotElementExists, 'text-error']
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
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">AdUnit path</span>
                <Tag>{slot.adUnitPath}</Tag>
              </div>
              {slot.sizes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-y-1">
                  <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Sizes</span>
                  {this.validateSlotSizes(slot.sizes).map(validatedSlotSize =>
                    this.tagFromValidatedSlotSize(validatedSlotSize, !!slot.sizeConfig)
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                {this.labelConfig(slot)}
              </div>
            </div>
          )}
          {activeTab === 'sizeConfig' && slot.sizeConfig && (
            <SizeConfigDebug
              sizeConfig={slot.sizeConfig}
              supportedLabels={labelConfigService.getSupportedLabels()}
            />
          )}
          {activeTab === 'bidders' && (
            <div>
              {slot.prebid && (
                <>
                  <SubHeadline>
                    Prebid{' '}
                    <Tag variant={this.isVisiblePrebid() ? 'green' : 'red'}>
                      {this.isVisiblePrebid() ? 'valid' : 'invalid'}
                    </Tag>
                  </SubHeadline>
                  {this.prebidConfig(slot.prebid)}
                </>
              )}
              {slot.a9 && (
                <>
                  <SubHeadline>
                    A9{' '}
                    <Tag variant={slotVisible && this.isVisibleA9() ? 'green' : 'red'}>
                      {slotVisible && this.isVisibleA9() ? 'valid' : 'invalid'}
                    </Tag>
                  </SubHeadline>
                  {this.a9Config(slot.a9)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  private prebidConfig = (prebid: headerbidding.PrebidAdSlotConfigProvider): React.ReactElement => {
    const prebidAdUnits: prebidjs.IAdUnit[] = extractPrebidAdSlotConfigs(prebid).map(
      config => config.adUnit
    );

    const hasMultipleBids = prebidAdUnits.length > 1;

    const elements = prebidAdUnits.map((prebidAdUnit, index) => {
      const slotSizeConfig = this.props.slot.sizeConfig;
      const banner = prebidAdUnit.mediaTypes.banner;
      const video = prebidAdUnit.mediaTypes.video;
      const native = prebidAdUnit.mediaTypes.native;
      return (
        <div key={index}>
          {index > 0 && <hr />}
          {hasMultipleBids && <h5 className="mb-1 mt-3 text-sm font-bold">{index + 1}. config</h5>}
          <div className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Code</span>
            <Tag variant="green">{prebidAdUnit.code || this.props.slot.domId}</Tag>
          </div>
          {banner && (
            <div className="mt-2 flex flex-wrap items-center gap-y-1">
              <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Banner sizes</span>
              {this.validateSlotSizes(banner.sizes).map(validatedSlotSize =>
                this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
              )}
            </div>
          )}
          {video && (
            <div className="mt-2 flex flex-wrap items-center gap-y-1">
              <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Video</span>
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
            <div className="mt-2 flex flex-wrap items-center gap-y-1">
              <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Native</span>
              <Tag variant="green">true</Tag>
            </div>
          )}
          {prebidAdUnit.bids.map((bid: prebidjs.IBid, idx: number) => (
            <Fragment key={idx}>
              <hr />
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
                  Bidder #{idx + 1}
                </span>
                <Tag variant="blue">{bid.bidder ?? bid.module}</Tag>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                {this.labelConfig(bid)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-y-1">
                <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Params</span>
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
          <h5 className="mb-1 mt-3 text-sm font-bold">{elements.length} bid configurations</h5>
          {elements}
        </div>
      );
    }
  };

  private a9Config = (a9: headerbidding.A9AdSlotConfig): React.ReactElement => {
    const slotSizeConfig = this.props.slot.sizeConfig;
    return (
      <div>
        {
          <div className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Sizes</span>
            {this.validateSlotSizes(this.props.slot.sizes.filter(AdSlotConfig.isFixedSize)).map(
              validatedSlotSize =>
                this.tagFromValidatedSlotSize(validatedSlotSize, !!slotSizeConfig)
            )}
          </div>
        }
        <div className="mt-2 flex flex-wrap items-center gap-y-1">{this.labelConfig(a9)}</div>
      </div>
    );
  };

  private isVisiblePrebid = (): boolean => {
    const prebid = this.props.slot.prebid;

    if (prebid) {
      return extractPrebidAdSlotConfigs(prebid)
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

  private validateSlotSizes = (sizes: googleAdManager.SlotSize[]): ValidatedSlotSize[] => {
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
  ): React.ReactElement => {
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

  private static isFixedSize(size: googleAdManager.SlotSize): size is [number, number] {
    return size !== 'fluid';
  }

  private labelConfig = (labelledSlot: {
    labelAll?: string[];
    labelAny?: string[];
  }): React.ReactElement => {
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
                'inline-block min-w-36 max-w-96 pr-1 font-medium',
                [labelAllMatches, 'text-success'],
                [!labelAllMatches, 'text-error']
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
                'inline-block min-w-36 max-w-96 pr-1 font-medium',
                [labelAnyMatches, 'text-success'],
                [!labelAnyMatches, 'text-error']
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
