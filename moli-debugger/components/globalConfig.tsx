import React, { Component, Fragment } from 'react';
import { ReportingService } from '@highfivve/ad-tag/source/ts/ads/reportingService';
import { LabelConfigService } from '@highfivve/ad-tag/source/ts/ads/labelConfigService';
import { createPerformanceService } from '@highfivve/ad-tag/source/ts/util/performanceService';
import {
  getActiveEnvironmentOverride,
  resetEnvironmentOverrides,
  setEnvironmentOverrideInStorage
} from '@highfivve/ad-tag/source/ts/util/environmentOverride';

import { AdSlotConfig } from './adSlotConfig';
import { Tag, TagLabel } from './tag';
import { classList } from '../util/stringUtils';
import { IWindowEventObserver, WindowResizeService } from '../util/windowResizeService';
import { Theme, ThemingService } from '../util/themingService';

import { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import { ModuleMeta } from '@highfivve/ad-tag/source/ts/types/module';
import { ConsentConfig } from './consentConfig';
import { LabelConfigDebug } from './labelConfigDebug';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import {
  getDebugDelayFromLocalStorage,
  setDebugDelayToLocalStorage
} from 'ad-tag/source/ts/util/debugDelay';
import { removeTestSlotSizeFromLocalStorage } from 'ad-tag/source/ts/util/test-slots';
import MoliConfig = Moli.MoliConfig;
import AdSlot = Moli.AdSlot;
import { checkBucketConfig, checkSkinConfig } from 'moli-debugger/validations/bucketValidations';

declare const window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow;

type IGlobalConfigProps = {
  config?: MoliConfig;
  modules: Array<ModuleMeta>;
  labelConfigService: LabelConfigService;
  windowResizeService: WindowResizeService;
  themingService: ThemingService;
};
type IGlobalConfigState = {
  sidebarHidden: boolean;
  expandSection: {
    slots: boolean;
    moli: boolean;
    modules: boolean;
    targeting: boolean;
    prebid: boolean;
    a9: boolean;
    labelSizeConfig: boolean;
    performance: boolean;
    consent: boolean;
    yieldOptimization: boolean;
  };
  messages: Message[];
  browserResized: boolean;
  showOnlyRenderedSlots: boolean;
  theme: Theme;
};

export type Message = {
  kind: 'error' | 'warning' | 'optimization';
  text: string | JSX.Element;
};

const debugSidebarSelector = 'moli-debug-sidebar';

export class GlobalConfig
  extends Component<IGlobalConfigProps, IGlobalConfigState>
  implements IWindowEventObserver
{
  constructor(props: IGlobalConfigProps) {
    super(props);
    this.state = {
      sidebarHidden: false,
      expandSection: {
        slots: true,
        moli: true,
        modules: false,
        targeting: false,
        prebid: false,
        a9: false,
        labelSizeConfig: false,
        performance: false,
        consent: false,
        yieldOptimization: false
      },
      messages: [],
      browserResized: false,
      showOnlyRenderedSlots: false,
      theme: props.themingService.currentTheme()
    };

    if (!props.config) {
      this.reportMissingConfig(this.state.messages);
    } else {
      props.config.slots.forEach(slot => {
        this.checkForDuplicateOrMissingSlots(this.state.messages, slot);
        this.checkSlotPrebidConfig(this.state.messages, slot);
        this.checkForWrongPrebidCodeEntry(this.state.messages, slot);
      });

      if (props.config.prebid) {
        this.checkPrebidConfig(this.state.messages, props.config.prebid);
      }

      if (props.config.labelSizeConfig) {
        props.config.labelSizeConfig.forEach(this.checkGlobalSizeConfigEntry(this.state.messages));
      }

      if (props.config.buckets) {
        checkBucketConfig(this.state.messages, props.config.buckets, props.config.slots);
      }

      checkSkinConfig(this.state.messages, props.modules, props.config.slots);

      props.windowResizeService.register(this);
    }
  }

  render(): JSX.Element {
    const { config, modules, labelConfigService } = this.props;
    const { sidebarHidden, showOnlyRenderedSlots, expandSection, theme } = this.state;
    const classes = classList('MoliDebug-sidebar', [sidebarHidden, 'is-hidden']);
    const showHideMessage = `${sidebarHidden ? 'Show' : 'Hide'} moli global config panel`;
    const isEnvironmentOverriden = !!getActiveEnvironmentOverride(window);
    const debugDelay = getDebugDelayFromLocalStorage(window);
    const isDarkTheme = theme === 'dark';
    const switchToDarkTheme = () => this.setTheme('dark');
    const switchToLightTheme = () => this.setTheme('light');

    return (
      <>
        <button
          className="MoliDebug-sidebar-closeHandle"
          title={showHideMessage}
          onClick={this.toggleSidebar}
        >
          {sidebarHidden && <span>&#11013; </span>}
          {!sidebarHidden && <span>&times; </span>}
          {showHideMessage}
        </button>
        {config && (
          <div className={classes} data-ref={debugSidebarSelector}>
            <div className="MoliDebug-sidebarSection  MoliDebug-sidebarSection--moli">
              <div className="MoliDebug-tagContainer">
                <TagLabel>Appearance</TagLabel>
                {isDarkTheme && (
                  <button
                    className="MoliDebug-button"
                    onClick={switchToLightTheme}
                    title="Switch to light theme"
                  >
                    🌔 dark
                  </button>
                )}
                {!isDarkTheme && (
                  <button
                    className="MoliDebug-button"
                    onClick={switchToDarkTheme}
                    title="Switch to dark theme"
                  >
                    🌞 light
                  </button>
                )}
              </div>
              <h4>
                {this.collapseToggle('moli')}
                Moli
              </h4>
              {expandSection.moli && (
                <div>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Mode</TagLabel>
                    {config.environment === 'test' ? (
                      <Tag variant="yellow">Test</Tag>
                    ) : (
                      <Tag variant="green">Production</Tag>
                    )}
                    {isEnvironmentOverriden ? (
                      <button
                        className="MoliDebug-button MoliDebug-button--green"
                        onClick={this.resetEnvironmentOverrides}
                      >
                        ◀ Reset override
                      </button>
                    ) : (
                      <button
                        className="MoliDebug-button MoliDebug-button--yellow MoliDebug-button--greyText"
                        onClick={this.overrideEnvironmentToTest}
                      >
                        ▶ Override to test
                      </button>
                    )}
                  </div>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Delay loading ads (only in test environment)</TagLabel>
                    <input
                      type="number"
                      placeholder="in milliseconds"
                      value={debugDelay}
                      list="debug-delay-suggestions"
                      disabled={config.environment !== 'test'}
                      onChange={e =>
                        setDebugDelayToLocalStorage(window, e.currentTarget.valueAsNumber)
                      }
                    />
                    <datalist id="debug-delay-suggestions">
                      <option value={500} />
                      <option value={1000} />
                      <option value={2000} />
                      <option value={3000} />
                    </datalist>
                  </div>
                  <div className="MoliDebug-tagContainer">
                    <button
                      className="MoliDebug-button MoliDebug-button--blue"
                      onClick={() => {
                        config.slots.forEach(removeTestSlotSizeFromLocalStorage);
                        window.location.reload();
                      }}
                    >
                      ▶ Reset all test slot sizes
                    </button>
                    <br />
                    <br />
                  </div>
                  {modules.length > 0 && (
                    <>
                      <h5>
                        {this.collapseToggle('modules')}
                        Moli Modules
                      </h5>
                      {expandSection.modules && (
                        <>
                          {modules.map((module, index) => {
                            const moduleConfig = module.config;

                            return (
                              <div key={index}>
                                <div
                                  className="MoliDebug-tagContainer MoliDebug-module"
                                  data-module-key={index + 1}
                                >
                                  <Tag>{module.name}</Tag>
                                </div>
                                <div className="MoliDebug-tagContainer">
                                  <TagLabel>Module Description</TagLabel>
                                  <Tag variant="transparent">{module.description}</Tag>
                                </div>
                                <div className="MoliDebug-tagContainer">
                                  <TagLabel>Module Type</TagLabel>
                                  <Tag variant="blue">{module.moduleType}</Tag>
                                </div>
                                {moduleConfig && (
                                  <Fragment>
                                    <h6>Module Config</h6>
                                    {this.unwrapConfig(moduleConfig)}
                                  </Fragment>
                                )}
                                {index !== modules.length - 1 && <hr />}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--slots">
              <h4>
                {this.collapseToggle('slots')}
                Slots
              </h4>

              {expandSection.slots && (
                <div>
                  <div className="MoliDebug-panel MoliDebug-panel--grey">
                    Slot sizes are annotated to show the origin of their validation state:
                    <ul>
                      <li>
                        <strong>Ⓢ</strong> means that the validation originates from the{' '}
                        <strong>slot's own sizeConfig</strong>,
                      </li>
                      <li>
                        <strong>Ⓖ</strong> indicates that the validation was done using the{' '}
                        <strong>global sizeConfig</strong>.
                      </li>
                    </ul>
                  </div>

                  <div className="MoliDebug-panel MoliDebug-panel--grey">
                    <label className="MoliDebug-checkBox">
                      <input
                        type="checkbox"
                        onChange={e =>
                          this.setState({
                            showOnlyRenderedSlots: (e.target as HTMLInputElement).checked
                          })
                        }
                      />
                      Show only rendered slots
                    </label>
                  </div>

                  {config.slots.map(slot =>
                    this.isSlotRendered(slot) || !showOnlyRenderedSlots ? (
                      <div key={slot.domId}>
                        <strong>{slot.behaviour.loaded}</strong> slot with DOM ID{' '}
                        <strong>{slot.domId}</strong>
                        <AdSlotConfig
                          labelConfigService={labelConfigService}
                          reportingConfig={config.reporting}
                          slot={slot}
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            <div className="MoliDebug-sidebarSection  MoliDebug-sidebarSection--targeting">
              <h4>
                {this.collapseToggle('targeting')}
                Targeting
              </h4>

              {expandSection.targeting && (
                <div>
                  {config.targeting && (
                    <div>
                      <h5>Key/value pairs</h5>
                      {this.keyValues(config.targeting.keyValues)}
                      <h5>Labels from publisher</h5>
                      {this.labels(config.targeting.labels)}
                      <h5>Labels from label size config</h5>
                      {this.labels(
                        labelConfigService
                          .getSupportedLabels()
                          .filter(l1 => !(config.targeting!.labels || []).find(l2 => l2 === l1))
                      )}
                    </div>
                  )}
                  {!config.targeting && <span>No targeting config present.</span>}
                </div>
              )}
            </div>

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--sizeConfig">
              <h4>
                {this.collapseToggle('labelSizeConfig')}
                Label Size config
              </h4>

              {expandSection.labelSizeConfig && (
                <div>
                  {config.labelSizeConfig && config.labelSizeConfig.length > 0 && (
                    <LabelConfigDebug labelSizeConfig={config.labelSizeConfig} />
                  )}
                  {(!config.labelSizeConfig || config.labelSizeConfig.length === 0) && (
                    <span>No size config present.</span>
                  )}
                </div>
              )}
            </div>

            {config.prebid && (
              <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--prebid">
                <h4>
                  {this.collapseToggle('prebid')}
                  Prebid
                </h4>

                {expandSection.prebid && (
                  <div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Version</TagLabel>
                      {window.pbjs.version ? (
                        <Tag>{window.pbjs.version.toString()}</Tag>
                      ) : (
                        <Tag variant="red">Prebid not found</Tag>
                      )}
                    </div>

                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Prebid debug</TagLabel>
                      <Tag variant={config.prebid.config.debug ? 'yellow' : undefined}>
                        {config.prebid.config.debug ? 'enabled' : 'disabled'}
                      </Tag>
                    </div>

                    {config.prebid.config.enableSendAllBids !== undefined && (
                      <div className="MoliDebug-tagContainer">
                        <TagLabel>sendAllBids enabled</TagLabel>
                        <Tag>{config.prebid.config.enableSendAllBids.toString()}</Tag>
                      </div>
                    )}

                    {config.prebid.config.bidderTimeout && (
                      <div className="MoliDebug-tagContainer">
                        <TagLabel>Bidder timeout</TagLabel>
                        <Tag>{`${config.prebid.config.bidderTimeout.toString()}ms`}</Tag>
                      </div>
                    )}

                    {config.prebid.config.consentManagement && (
                      <div>
                        <h5>Consent management</h5>
                        <div className="MoliDebug-tagContainer">
                          <TagLabel>allowAuctionWithoutConsent</TagLabel>
                          <Tag>
                            {(!!config.prebid.config.consentManagement
                              .allowAuctionWithoutConsent).toString()}
                          </Tag>
                        </div>
                        {config.prebid.config.consentManagement.cmpApi && (
                          <div className="MoliDebug-tagContainer">
                            <TagLabel>CMP API</TagLabel>
                            <Tag>{config.prebid.config.consentManagement.cmpApi}</Tag>
                          </div>
                        )}
                        <div className="MoliDebug-tagContainer">
                          <TagLabel>CMP timeout</TagLabel>
                          <Tag>{`${config.prebid.config.consentManagement.timeout}ms`}</Tag>
                        </div>
                      </div>
                    )}

                    {config.prebid.config.userSync && (
                      <div>
                        <h5>User sync</h5>
                        <div className="MoliDebug-tagContainer">
                          <TagLabel>Sync enabled</TagLabel>
                          <Tag>
                            {config.prebid.config.userSync.syncEnabled === undefined
                              ? `${window.pbjs
                                  .getConfig()
                                  .userSync?.syncEnabled?.toString()} (default from prebid config - no value in moli config)`
                              : config.prebid.config.userSync.syncEnabled.toString()}
                          </Tag>
                        </div>
                        {config.prebid.config.userSync.syncDelay !== undefined && (
                          <div className="MoliDebug-tagContainer">
                            <TagLabel>Sync delay</TagLabel>
                            <Tag>{`${config.prebid.config.userSync.syncDelay}ms`}</Tag>
                          </div>
                        )}
                        {config.prebid.config.userSync.syncsPerBidder !== undefined && (
                          <div className="MoliDebug-tagContainer">
                            <TagLabel>Syncs per bidder</TagLabel>
                            <Tag>{config.prebid.config.userSync.syncsPerBidder.toString()}</Tag>
                          </div>
                        )}
                        <div className="MoliDebug-tagContainer">
                          <TagLabel>User sync override enabled</TagLabel>
                          <Tag>{(!!config.prebid.config.userSync.enableOverride).toString()}</Tag>
                        </div>
                        {config.prebid.config.userSync.filterSettings && (
                          <div>
                            <h6>Filter Settings</h6>
                            {config.prebid.config.userSync.filterSettings.all &&
                              this.filterSetting(
                                'All',
                                config.prebid.config.userSync.filterSettings.all
                              )}
                            {config.prebid.config.userSync.filterSettings.iframe &&
                              this.filterSetting(
                                'iFrame',
                                config.prebid.config.userSync.filterSettings.iframe
                              )}
                            {config.prebid.config.userSync.filterSettings.image &&
                              this.filterSetting(
                                'Image',
                                config.prebid.config.userSync.filterSettings.image
                              )}
                          </div>
                        )}
                      </div>
                    )}

                    <h5>Currency</h5>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Ad server currency</TagLabel>
                      <Tag>{config.prebid.config.currency.adServerCurrency}</Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Granularity multiplier</TagLabel>
                      <Tag>{config.prebid.config.currency.granularityMultiplier.toString()}</Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Default Rates, USD → EUR</TagLabel>
                      <Tag>{config.prebid.config.currency.defaultRates.USD.EUR.toString()}</Tag>
                    </div>
                  </div>
                )}
              </div>
            )}

            {config.a9 && (
              <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--a9">
                <h4>
                  {this.collapseToggle('a9')}
                  A9
                </h4>

                {expandSection.a9 && (
                  <div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>PubID</TagLabel>
                      <Tag variant={config.a9.pubID ? 'blue' : 'red'}>{config.a9.pubID}</Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Timeout</TagLabel>
                      <Tag variant={config.a9.timeout ? 'blue' : 'red'}>
                        {config.a9.timeout.toFixed(0)}ms
                      </Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>CMP timeout</TagLabel>
                      <Tag variant={config.a9.cmpTimeout ? 'blue' : 'red'}>
                        {config.a9.cmpTimeout.toFixed(0)}ms
                      </Tag>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--consent">
              <h4>
                {this.collapseToggle('consent')}
                Consent
              </h4>

              {expandSection.consent && (
                <div>
                  <ConsentConfig />
                </div>
              )}
            </div>

            {
              <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--performance">
                <h4>
                  {this.collapseToggle('performance')}
                  Performance
                </h4>

                {expandSection.performance && (
                  <div>
                    {this.singlePerformanceMeasure('ttfa')}
                    {this.singlePerformanceMeasure('ttfr')}
                    {this.singlePerformanceMeasure('prebidLoad')}
                    {this.singlePerformanceMeasure('a9Load')}
                    {this.singlePerformanceMeasure('dfpLoad')}
                  </div>
                )}
              </div>
            }

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--linting">
              <h4>Moli configuration issues and warnings</h4>
              {this.state.messages.map((message, index) => (
                <div
                  key={`${message.text}-${index}`}
                  className={classList(
                    'MoliDebug-configMessage',
                    `MoliDebug-configMessage--${message.kind}`
                  )}
                >
                  {this.iconForMessageKind(message.kind)}
                  {message.text}
                </div>
              ))}
              {this.state.messages.length === 0 && (
                <div
                  className={classList('MoliDebug-configMessage', `MoliDebug-configMessage--empty`)}
                >
                  {this.iconForMessageKind('empty')}
                  No errors or warnings found. You're all set!
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  public listener = (): void => {
    this.setState({ browserResized: true });
  };

  public componentWillUnmount = (): void => {
    this.props.windowResizeService.unregister(this);
  };

  private resetEnvironmentOverrides = () => {
    resetEnvironmentOverrides(window);
  };

  private overrideEnvironmentToTest = () => {
    setEnvironmentOverrideInStorage('test', localStorage);
    window.location.reload();
  };

  private unwrapConfig = (moduleConfig: Object, subEntry: boolean = false): JSX.Element => {
    return (
      <Fragment key={Math.random()}>
        {Object.keys(moduleConfig).map(key => {
          const configValue = moduleConfig[key];
          const configValueType: 'other' | 'object' | 'array' =
            typeof configValue === 'object'
              ? Array.isArray(configValue)
                ? 'array'
                : 'object'
              : 'other';

          return (
            <div
              key={key}
              className={classList('MoliDebug-tagContainer', [
                subEntry,
                'MoliDebug-tagContainer--subEntry'
              ])}
            >
              <TagLabel>{key}</TagLabel>
              {configValueType === 'array' &&
                (configValue.length === 0 ? (
                  <i>No values</i>
                ) : (
                  configValue.map((value: unknown, index: number) =>
                    typeof value === 'object' ? (
                      this.unwrapConfig(value as Object, true)
                    ) : (
                      <Tag variant="green" key={index}>
                        {(value as any).toString()}
                      </Tag>
                    )
                  )
                ))}
              {configValueType === 'object' && this.unwrapConfig(configValue, true)}
              {configValueType === 'other' && <Tag variant="green">{configValue.toString()}</Tag>}
            </div>
          );
        })}
      </Fragment>
    );
  };

  private setTheme = (theme: Theme) =>
    this.setState({ theme }, () => this.props.themingService.applyTheme(theme));

  private keyValues = (keyValues: Moli.DfpKeyValueMap): JSX.Element => {
    const properties = Object.keys(keyValues);

    return properties.length > 0 ? (
      <table className="MoliDebug-keyValueTable">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((key: string) => {
            const value = keyValues[key];

            return (
              <tr key={key}>
                <td>{key}</td>
                <td>
                  {Array.isArray(value)
                    ? value.map(this.standardTagFromString)
                    : this.standardTagFromString(value!)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : (
      <span>No key/values config present.</span>
    );
  };

  private labels = (labels: string[] | undefined): JSX.Element => {
    return (
      <div className="MoliDebug-tagContainer">
        {labels &&
          labels.map(label => (
            <Tag key={label} variant="blue" spacing="medium">
              {label}
            </Tag>
          ))}
        {(!labels || labels.length === 0) && <span>No labels present.</span>}
      </div>
    );
  };

  private filterSetting = (
    name: string,
    filterSetting: prebidjs.userSync.IFilterSetting
  ): JSX.Element => {
    return (
      <div>
        <strong>{name}</strong>
        <div className="MoliDebug-tagContainer">
          <TagLabel>Bidders</TagLabel>
          {filterSetting.bidders === '*'
            ? this.standardTagFromString('all')
            : filterSetting.bidders.map(this.standardTagFromString)}
        </div>
        <div className="MoliDebug-tagContainer">
          <TagLabel>Include/exclude</TagLabel>
          {this.standardTagFromString(filterSetting.filter)}
        </div>
      </div>
    );
  };

  private standardTagFromString = (content: string): JSX.Element => {
    return <Tag key={content}>{content}</Tag>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
  };

  private singlePerformanceMeasure = (
    name: 'dfpLoad' | 'prebidLoad' | 'a9Load' | 'ttfa' | 'ttfr'
  ): JSX.Element => {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName(name);
    const entry = createPerformanceService(window).getMeasure(measure);
    if (entry) {
      const color: 'green' | 'yellow' | 'red' =
        entry.duration > 5000 ? 'red' : entry.duration > 2000 ? 'yellow' : 'green';
      return (
        <div className="MoliDebug-tagContainer">
          <TagLabel>{name}</TagLabel>
          <Tag variant={color}>{entry.duration.toFixed(0)} ms</Tag>
        </div>
      );
    }
    return (
      <div className="MoliDebug-tagContainer">
        <TagLabel>{name}</TagLabel>
        <Tag variant="blue">no entry</Tag>
      </div>
    );
  };

  private collapseToggle = (
    section: keyof Pick<
      IGlobalConfigState['expandSection'],
      | 'slots'
      | 'moli'
      | 'modules'
      | 'targeting'
      | 'prebid'
      | 'a9'
      | 'labelSizeConfig'
      | 'performance'
      | 'consent'
    >
  ): JSX.Element => {
    const toggleValue = (
      section: keyof Pick<
        IGlobalConfigState['expandSection'],
        | 'slots'
        | 'moli'
        | 'modules'
        | 'targeting'
        | 'prebid'
        | 'a9'
        | 'labelSizeConfig'
        | 'performance'
        | 'consent'
      >
    ) => {
      const oldVal = this.state.expandSection[section];
      this.setState({ expandSection: { ...this.state.expandSection, [section]: !oldVal } });
    };
    return (
      <button
        className="MoliDebug-adSlot-button"
        title={`${this.state.expandSection[section] ? 'collapse' : 'expand'} ${section}`}
        onClick={() => toggleValue(section)}
      >
        {this.state.expandSection[section] ? '⊖' : '⊕'}
      </button>
    );
  };

  private iconForMessageKind = (kind: Message['kind'] | 'empty'): JSX.Element => {
    return (
      <span className="MoliDebug-configMessage-icon">
        {kind === 'error' && <span>&#x2757;</span>}
        {kind === 'warning' && <span>&#x26A0;</span>}
        {kind === 'empty' && <span>✔</span>}
      </span>
    );
  };

  private reportMissingConfig = (messages: Message[]): void => {
    messages.push({
      kind: 'error',
      text: 'No moli config found.'
    });
  };

  private checkForDuplicateOrMissingSlots = (messages: Message[], slot: AdSlot): void => {
    const count = document.querySelectorAll(`#${slot.domId}`).length;

    if (count > 1) {
      messages.push({
        kind: 'warning',
        text: (
          <span>
            {count} DOM elements with id <strong>{slot.domId}</strong> found. This may lead to
            unexpected results.
          </span>
        )
      });
    }

    if (count === 0) {
      messages.push({
        kind: 'warning',
        text: (
          <span>
            No DOM element with id <strong>{slot.domId}</strong> found. Slot will not be rendered.
          </span>
        )
      });
    }
  };

  private checkPrebidConfig = (messages: Message[], prebid: Moli.headerbidding.PrebidConfig) => {
    if (!prebid.config.consentManagement) {
      messages.push({
        kind: 'error',
        text: 'No prebid consentManagement configuration found.'
      });
    }

    if (!window.pbjs.version) {
      messages.push({
        kind: 'error',
        text: 'No prebid instance available! Either remove the prebid configuration or add prebid to the ad tag'
      });
    }
  };

  private checkSlotPrebidConfig = (messages: Message[], slot: AdSlot) => {
    if (slot.prebid) {
      const labels = this.props.labelConfigService.getSupportedLabels();
      extractPrebidAdSlotConfigs(
        {
          keyValues: {},
          floorPrice: undefined,
          labels,
          isMobile: !labels.includes('desktop')
        },
        slot.prebid
      ).forEach(prebidConfig => {
        const mediaTypes = prebidConfig.adUnit.mediaTypes;

        if (!!mediaTypes && !mediaTypes.banner && !mediaTypes.video) {
          messages.push({
            kind: 'error',
            text: `Prebidjs mediaTypes for slot ${slot.domId} | ${slot.adUnitPath} is empty.`
          });
        }
      });
    }
  };

  private checkGlobalSizeConfigEntry =
    (messages: Message[]) =>
    (entry: Moli.LabelSizeConfigEntry, _: number): void => {
      if (entry.labelsSupported.length === 0) {
        messages.push({
          kind: 'warning',
          text: `No Global LabelSizeConfig entries. We recommend defining labels.`
        });
      }
    };

  private checkForWrongPrebidCodeEntry = (messages: Message[], slot: AdSlot) => {
    if (slot.prebid) {
      const labels = this.props.labelConfigService.getSupportedLabels();
      extractPrebidAdSlotConfigs(
        {
          keyValues: {},
          floorPrice: undefined,
          labels,
          isMobile: !labels.includes('desktop')
        },
        slot.prebid
      ).forEach(prebidConfig => {
        const code = prebidConfig.adUnit.code;
        if (code && code !== slot.domId) {
          messages.push({
            kind: 'error',
            text: (
              <span>
                The <code>prebid.adUnit.code</code> must match the <code>slot.domID</code>{' '}
                <strong>${slot.domId}</strong>, but
                <br /> <strong>{code}</strong> was not <strong>{slot.domId}</strong>
              </span>
            )
          });
        }
      });
    }
  };

  private isSlotRendered = (slot: AdSlot): boolean =>
    !!document.getElementById(slot.domId) && this.props.labelConfigService.filterSlot(slot);
}
