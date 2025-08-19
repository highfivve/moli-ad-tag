import React, { Component, Fragment } from 'react';

import { AdSlotConfig } from './adSlotConfig';
import { Tag, TagLabel } from './tag';
import { classList } from '../util/stringUtils';
import { IWindowEventObserver, WindowResizeService } from '../util/windowResizeService';
import { Theme, ThemingService } from '../util/themingService';

import { ConsentConfig } from './consentConfig';
import { LabelConfigDebug } from './labelConfigDebug';
import { extractPrebidAdSlotConfigs } from '../util/prebid';
import { checkAdReloadConfig } from '../validations/adReloadValidations';
import { checkSizesConfig } from '../validations/sizesConfigValidations';
import { prebidjs } from '../../types/prebidjs';
import { googletag } from '../../types/googletag';
import { MoliRuntime } from '../../types/moliRuntime';
import {
  AdSlot,
  googleAdManager,
  headerbidding,
  sizeConfigs,
  modules,
  MoliConfig
} from '../../types/moliConfig';
import { LabelConfigService } from '../../ads/labelConfigService';
import { checkBucketConfig, checkSkinConfig } from '../validations/bucketValidations';
import {
  getActiveEnvironmentOverride,
  resetEnvironmentOverrides,
  setEnvironmentOverrideInStorage
} from '../../util/environmentOverride';
import { getDebugDelayFromLocalStorage, setDebugDelayToLocalStorage } from 'ad-tag/util/debugDelay';
import { removeTestSlotSizeFromLocalStorage } from 'ad-tag/util/test-slots';

// @ts-ignore
import styles from './../debug.pcss';
import { resolveOverrides } from 'ad-tag/util/resolveOverrides';
import { QueryParameters } from 'ad-tag/util/queryParameters';
import { BrowserStorageKeys } from 'ad-tag/util/browserStorageKeys';
import { calculateAdDensity } from 'ad-tag/console/util/calculateAdDensity';
import { extractPositionFromPath } from 'ad-tag/console/util/extractPositionFromPath';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from 'ad-tag/util/localStorage';

declare const window: Window &
  prebidjs.IPrebidjsWindow &
  googletag.IGoogleTagWindow &
  MoliRuntime.MoliWindow;

type IGlobalConfigProps = {
  config?: MoliConfig;
  runtimeConfig: MoliRuntime.MoliRuntimeConfig;
  modules?: modules.ModulesConfig;
  labelConfigService: LabelConfigService;
  windowResizeService: WindowResizeService;
  themingService: ThemingService;
};
type AdDensityState = {
  totalAdDensity: number | undefined;
  percentagePerSlot: { adSlotId: string | undefined; percentage: string | undefined }[];
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
    consent: boolean;
    yieldOptimization: boolean;
    supplyChain: boolean;
    adDensity: boolean;
  };
  messages: Message[];
  browserResized: boolean;
  showOnlyRenderedSlots: boolean;
  theme: Theme;
  adstxtEntry: string[];
  adstxtDomain: string;
  adstxtError: string;
  adDensity: AdDensityState;
  configVersion: string;
};

export type Message = {
  kind: 'error' | 'warning' | 'optimization';
  text: React.ReactNode;
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
        consent: false,
        yieldOptimization: false,
        supplyChain: false,
        adDensity: false
      },
      messages: [],
      browserResized: false,
      showOnlyRenderedSlots: false,
      theme: props.themingService.currentTheme(),
      adstxtEntry: [],
      adstxtDomain: '',
      adstxtError: '',
      adDensity: {
        totalAdDensity: undefined,
        percentagePerSlot: []
      },
      configVersion: 'not available'
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
      checkAdReloadConfig(
        this.state.messages,
        props.modules,
        props.config.slots,
        this.props.labelConfigService.getSupportedLabels()
      );

      checkSizesConfig(
        this.state.messages,
        props.config.slots,
        this.props.labelConfigService.getSupportedLabels()
      );
      props.windowResizeService.register(this);
    }
  }

  async fetchAdsTxtEntries(hostname: string): Promise<string | undefined> {
    try {
      if (hostname) {
        const domain = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
        const response = await fetch(`https://${domain}/ads.txt`);
        return await response.text();
      }
    } catch (error) {
      console.error(error);
    }
  }

  parseAdsTxtEntries(adstxtEntries: string): string[] | undefined {
    // Split the entries string on each new line and comma
    const entriesArray = adstxtEntries.split(/\r?\n/).map(entry => entry.split(',')) ?? [];
    const publisherEntry = entriesArray
      // filter out lines that don't carry relevant info e.g. header of the ads.txt
      .filter(entry => entry.length > 1)
      .find(entry => entry[0] === 'highfivve.com');

    return publisherEntry;
  }

  async findPublisherEntryInAdsTxt(adsTxtDomain: string) {
    try {
      const adstxtEntries = await this.fetchAdsTxtEntries(adsTxtDomain);

      if (!adstxtEntries) {
        throw new Error('Failed to fetch ads.txt entries.');
      }

      // reset ads.txt error to initial state
      this.setState({ adstxtError: '' });

      const publisherEntry = this.parseAdsTxtEntries(adstxtEntries);
      return publisherEntry;
    } catch (error) {
      if (error instanceof Error) {
        this.setState({ adstxtError: error.message });
      } else {
        this.setState({ adstxtError: 'An unknown error occurred.' });
      }

      return ['', 'error'];
    }
  }

  async componentDidMount() {
    const adsTxtDomain = this.props.config?.domain ?? window.location.hostname;
    this.setState({
      adstxtDomain: adsTxtDomain,
      adstxtEntry: (await this.findPublisherEntryInAdsTxt(adsTxtDomain)) ?? [],
      configVersion: this.props.config?.version ?? 'not available'
    });
  }

  render(): React.ReactElement {
    const { config, runtimeConfig, modules, labelConfigService } = this.props;

    const configLabel = window.moli.configLabel ?? 'not available';
    const currentConfigVersion = window.moli.getConfig()?.version ?? 'not available';
    const isVersionOverridden =
      resolveOverrides(window, QueryParameters.moliVersion, BrowserStorageKeys.moliVersion).length >
      0;

    const {
      sidebarHidden,
      showOnlyRenderedSlots,
      expandSection,
      theme,
      adstxtEntry,
      adstxtDomain,
      adDensity
    } = this.state;
    const classes = classList('MoliDebug-sidebar', [sidebarHidden, 'is-hidden']);
    const showHideMessage = `${sidebarHidden ? 'Show' : 'Hide'} moli global config panel`;
    const isEnvironmentOverridden = !!getActiveEnvironmentOverride(window);
    const interstitialTestKey = 'test-interstitial';
    const isInterstitialTestEnabled = !!getBrowserStorageValue(interstitialTestKey, localStorage);
    const debugDelay = getDebugDelayFromLocalStorage(window);
    const isDarkTheme = theme === 'dark';
    const switchToDarkTheme = () => this.setTheme('dark');
    const switchToLightTheme = () => this.setTheme('light');

    return (
      <div id="moli-console-global-config">
        <style>{styles}</style>
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
                <div className="MoliDebug-tagContainer">
                  <TagLabel>Config version</TagLabel>
                  <Tag variant={isVersionOverridden ? 'yellow' : 'blue'}>
                    {currentConfigVersion}
                  </Tag>
                  <input
                    type="text"
                    value={this.state.configVersion}
                    placeholder={currentConfigVersion}
                    onChange={e => {
                      this.setState({ configVersion: e.currentTarget.value });
                    }}
                  />
                  <button
                    className="MoliDebug-button"
                    onClick={() => this.overrideConfigVersion(this.state.configVersion)}
                    title="Reload"
                  >
                    load
                  </button>
                  <button
                    className="MoliDebug-button MoliDebug-button--green"
                    onClick={this.clearConfigVersionOverride}
                    title="Reset"
                  >
                    reset
                  </button>
                </div>
                <div className="MoliDebug-tagContainer">
                  <TagLabel>Config label</TagLabel>
                  <Tag>{configLabel}</Tag>
                </div>
                <br />
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
                Moli <span>{window.moli.version}</span>
              </h4>
              {expandSection.moli && (
                <div>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Overall Mode</TagLabel>
                    {runtimeConfig.environment === 'test' ? (
                      <Tag variant="yellow">Test</Tag>
                    ) : (
                      <Tag variant="green">Production</Tag>
                    )}
                    {isEnvironmentOverridden ? (
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
                    <TagLabel>Interstitital Test Mode</TagLabel>
                    {isInterstitialTestEnabled ? (
                      <button
                        className="MoliDebug-button MoliDebug-button--green"
                        onClick={() => {
                          removeBrowserStorageValue(interstitialTestKey, localStorage);
                          window.location.reload();
                        }}
                      >
                        ◀ Reset interstitial test
                      </button>
                    ) : (
                      <button
                        className={`MoliDebug-button MoliDebug-button--yellow MoliDebug-button--greyText ${!isEnvironmentOverridden ? 'MoliDebug-button--disabled' : ''}`}
                        onClick={() => {
                          setBrowserStorageValue(interstitialTestKey, 'true', localStorage);
                          window.location.reload();
                        }}
                        disabled={!isEnvironmentOverridden}
                      >
                        ▶ Test interstitial
                      </button>
                    )}
                    {!isEnvironmentOverridden && (
                      <p className="MoliDebug-info">
                        ❗️Please activate overall test mode before testing the interstitial.
                      </p>
                    )}
                  </div>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Delay loading ads (only in test environment)</TagLabel>
                    <input
                      type="number"
                      placeholder="in milliseconds"
                      value={debugDelay}
                      list="debug-delay-suggestions"
                      disabled={runtimeConfig.environment !== 'test'}
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
                  </div>
                  {modules && (
                    <>
                      <h5>
                        {this.collapseToggle('modules')}
                        Moli Modules
                      </h5>
                      {expandSection.modules && (
                        <>
                          {Object.entries(modules).map(([module, config], index) => {
                            const moduleConfig = config as modules.IModuleConfig;
                            return (
                              <div key={index}>
                                <div
                                  className="MoliDebug-tagContainer MoliDebug-module"
                                  data-module-key={index + 1}
                                >
                                  <Tag variant={moduleConfig.enabled ? 'green' : 'grey'}>
                                    {module}
                                  </Tag>
                                </div>
                                {moduleConfig && (
                                  <Fragment>
                                    <h6>Module Config</h6>
                                    {this.unwrapConfig(moduleConfig)}
                                  </Fragment>
                                )}
                                {index !== Object.keys(modules).length - 1 && <hr />}
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

                  {config.slots.map((slot, index) =>
                    this.isSlotRendered(slot) || !showOnlyRenderedSlots ? (
                      <div key={index}>
                        <strong>{slot.behaviour.loaded}</strong> slot with DOM ID{' '}
                        <strong>{slot.domId}</strong>
                        <AdSlotConfig labelConfigService={labelConfigService} slot={slot} />
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
                      {this.keyValues({
                        ...config.targeting.keyValues,
                        ...runtimeConfig.keyValues
                      })}
                      <h5>Labels from publisher</h5>
                      {this.labels([...runtimeConfig.labels, ...(config.targeting?.labels ?? [])])}
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
                            {(
                              !!config.prebid.config.consentManagement.gdpr
                                ?.allowAuctionWithoutConsent ?? 'true'
                            ).toString()}
                          </Tag>
                        </div>
                        {config.prebid.config.consentManagement.gdpr?.cmpApi && (
                          <div className="MoliDebug-tagContainer">
                            <TagLabel>CMP API</TagLabel>
                            <Tag>
                              {config.prebid.config.consentManagement.gdpr?.cmpApi ?? 'iab'}
                            </Tag>
                          </div>
                        )}
                        <div className="MoliDebug-tagContainer">
                          <TagLabel>CMP timeout</TagLabel>
                          <Tag>{`${
                            config.prebid.config.consentManagement.gdpr?.timeout ?? 10000
                          }ms`}</Tag>
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
                      <Tag>
                        {config.prebid.config.currency?.adServerCurrency ?? 'EUR (default)'}
                      </Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Granularity multiplier</TagLabel>
                      <Tag>
                        {config.prebid.config.currency?.granularityMultiplier.toString() ??
                          'not set'}
                      </Tag>
                    </div>
                    <div className="MoliDebug-tagContainer">
                      <TagLabel>Default Rates, USD → EUR</TagLabel>
                      <Tag>
                        {config.prebid.config.currency?.defaultRates.USD.EUR?.toString() ??
                          'not set'}
                      </Tag>
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

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--supplyChain">
              <h4>
                {this.collapseToggle('supplyChain')}
                Supply Chain
              </h4>

              {expandSection.supplyChain && (
                <>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Seller ID (ads.txt)</TagLabel>
                    <Tag
                      variant={
                        adstxtEntry[1] === config?.schain.supplyChainStartNode.sid ? 'green' : 'red'
                      }
                    >
                      {adstxtEntry[1]}
                    </Tag>
                  </div>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Status</TagLabel>
                    <Tag variant={adstxtEntry[2] ? 'blue' : 'red'}>{adstxtEntry[2]}</Tag>
                  </div>
                  <p className="MoliDebug-info">
                    {config?.schain.supplyChainStartNode.sid === adstxtEntry[1]
                      ? `✅ Seller ids in ad tag config and ads.txt of domain ${adstxtDomain} are matching!`
                      : `❗️Seller ids in ad tag config (${config?.schain.supplyChainStartNode.sid}) and ads.txt of current domain (${adstxtDomain}, ${adstxtEntry[1]}) are different!`}
                  </p>
                  {this.state.adstxtError !== '' && (
                    <p className="MoliDebug-panel MoliDebug-panel--red">{`${this.state.adstxtError} If you use this console locally or on the demo page, try to enable CORS by using a CORS unblocking browser extension.`}</p>
                  )}
                  <form
                    className="MoliDebug-formContainer MoliDebug-panel MoliDebug-panel--blue"
                    onSubmit={async event => {
                      event.preventDefault();
                      const newAdsTxtDomain = event.target[0].value;
                      this.setState({
                        adstxtDomain: newAdsTxtDomain,
                        adstxtEntry: (await this.findPublisherEntryInAdsTxt(newAdsTxtDomain)) ?? []
                      });
                    }}
                  >
                    <label htmlFor="newDomain">
                      Use different ads.txt domain for seller id comparison:
                    </label>
                    <div>
                      <input
                        type="text"
                        placeholder="Enter new domain"
                        name="newDomain"
                        id="newDomain"
                      ></input>
                      <button className="MoliDebug-button" type="submit">
                        Go!
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--supplyChain">
              <h4>
                {this.collapseToggle('adDensity')}
                Ad Density
              </h4>

              {expandSection.adDensity && (
                <>
                  <form
                    className="MoliDebug-formContainer MoliDebug-panel MoliDebug-panel--blue"
                    onSubmit={async event => {
                      event.preventDefault();
                      const contentSelector = event.target[0].value;
                      const { totalAdDensity, adAreaPerSlot } = calculateAdDensity(
                        contentSelector,
                        undefined
                      );

                      const percentagePerSlot = adAreaPerSlot.map(adArea => {
                        if (!adArea || !adDensity.totalAdDensity) {
                          return {
                            adSlotId: adArea?.adSlot ? adArea.adSlot : 'unknown',
                            percentage: '0.00'
                          };
                        }
                        return {
                          adSlotId: adArea.adSlot,
                          percentage: ((adArea.adArea / adDensity.totalAdDensity) * 100).toFixed(2)
                        };
                      });

                      this.setState({
                        adDensity: { totalAdDensity, percentagePerSlot }
                      });
                    }}
                  >
                    <label htmlFor="adDensitySelector">
                      Calculate ad density of the content element
                    </label>
                    <div>
                      <input
                        type="text"
                        placeholder="Enter CSS selector"
                        name="adDensitySelector"
                        id="adDensitySelector"
                      ></input>
                      <button className="MoliDebug-button" type="submit">
                        Go!
                      </button>
                    </div>
                  </form>
                  <div className="MoliDebug-tagContainer">
                    <TagLabel>Ad Density</TagLabel>
                    <Tag variant={'green'}>{adDensity.totalAdDensity}</Tag>
                  </div>
                  {adDensity.percentagePerSlot.length > 0 && (
                    <>
                      <hr />
                      <h4>Percentage of ad slot area on total ad area</h4>
                      {adDensity.percentagePerSlot.map(percentage => {
                        return (
                          <div className="MoliDebug-tagContainer" key={percentage.adSlotId}>
                            <TagLabel>{extractPositionFromPath(percentage.adSlotId)}</TagLabel>
                            <Tag variant={'green'}>{percentage.percentage}%</Tag>
                          </div>
                        );
                      })}
                      <hr />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
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

  private overrideConfigVersion = (version: string) => {
    window.localStorage.setItem(BrowserStorageKeys.moliVersion, version);
    window.location.reload();
  };

  private clearConfigVersionOverride = () => {
    window.localStorage.removeItem(BrowserStorageKeys.moliVersion);
  };

  private unwrapConfig = (moduleConfig: Object, subEntry: boolean = false): React.ReactElement => {
    return (
      <Fragment>
        {Object.keys(moduleConfig).map((key, index) => {
          const configValue = moduleConfig[key];
          const configValueType: 'other' | 'object' | 'array' =
            typeof configValue === 'object'
              ? Array.isArray(configValue)
                ? 'array'
                : 'object'
              : 'other';

          return (
            <div
              key={index}
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
                        {value !== undefined ? (value as any).toString() : 'undefined'}
                      </Tag>
                    )
                  )
                ))}
              {configValueType === 'object' && this.unwrapConfig(configValue, true)}
              {configValueType === 'other' && configValue !== undefined && (
                <Tag variant="green">{configValue.toString()}</Tag>
              )}
            </div>
          );
        })}
      </Fragment>
    );
  };

  private setTheme = (theme: Theme) =>
    this.setState({ theme }, () => this.props.themingService.applyTheme(theme));

  private keyValues = (keyValues: googleAdManager.KeyValueMap): React.ReactElement => {
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

  private labels = (labels: string[] | undefined): React.ReactElement => {
    return (
      <div className="MoliDebug-tagContainer">
        {labels &&
          labels.map((label, index) => (
            <Tag key={index} variant="blue" spacing="medium">
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
  ): React.ReactElement => {
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

  private standardTagFromString = (content: string): React.ReactElement => {
    return <Tag key={content}>{content}</Tag>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
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
      | 'consent'
      | 'supplyChain'
      | 'adDensity'
    >
  ): React.ReactElement => {
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
        | 'consent'
        | 'supplyChain'
        | 'adDensity'
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

  private iconForMessageKind = (kind: Message['kind'] | 'empty'): React.ReactElement => {
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
    const count = document.querySelectorAll(`[id='${slot.domId}']`).length;

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

  private checkPrebidConfig = (messages: Message[], prebid: headerbidding.PrebidConfig) => {
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
      extractPrebidAdSlotConfigs(slot.prebid).forEach(prebidConfig => {
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
    (entry: sizeConfigs.LabelSizeConfigEntry, _: number): void => {
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
      extractPrebidAdSlotConfigs(slot.prebid).forEach(prebidConfig => {
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
