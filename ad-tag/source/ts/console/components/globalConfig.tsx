import React, { Component } from 'react';

import { AdSlotConfig } from './adSlotConfig';
import { ModuleConfigs } from './moduleConfigs';
import { Tag, TagLabel } from './tag';
import { Block, Btn, Panel, SubHeadline, Tabs, TagContainer, TextInput, Toggle } from './ui';
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
  showOverlays: boolean;
  onShowOverlaysChange: (show: boolean) => void;
};
type AdDensityState = {
  totalAdDensity: number | undefined;
  percentagePerSlot: { adSlotId: string | undefined; percentage: string | undefined }[];
};

export type ConsoleTab = 'overview' | 'adSetup' | 'debugging';

type IGlobalConfigState = {
  sidebarHidden: boolean;
  activeTab: ConsoleTab;
  /** slot that was clicked in the overview; opened and scrolled to in the ad setup tab */
  selectedSlotDomId?: string;
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
      activeTab: 'overview',
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

  refreshInterstitial(interstitialSlot?: AdSlot): void {
    if (interstitialSlot) {
      if (interstitialSlot.behaviour.loaded !== 'infinite') {
        window.moli.refreshAdSlot(interstitialSlot.domId, {
          loaded: interstitialSlot.behaviour.loaded
        });
        this.toggleSidebar();
      } else {
        console.error("Interstitial slot's loading behaviour can not be of type 'infinite'.");
      }
    } else {
      console.error('Interstitial slot not found in the current config.');
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
    const { config } = this.props;
    const { sidebarHidden, activeTab } = this.state;

    const classes = classList(
      'fixed right-0 top-0 z-[99999999] box-border block max-h-screen w-full max-w-full overflow-y-auto bg-base-100 pb-4 pt-10 text-left text-sm text-base-content shadow-[-3px_0_5px_0_rgba(0,0,0,0.2)] md:w-[700px]',
      [sidebarHidden, 'hidden']
    );
    const showHideMessage = `${sidebarHidden ? 'Show' : 'Hide'} moli global config panel`;

    return (
      <div id="moli-console-global-config">
        <style>{styles}</style>
        <button
          className="d-btn d-btn-warning d-btn-sm fixed left-0 top-0 z-[100000000] w-screen justify-start rounded-none font-normal normal-case md:left-auto md:right-0 md:w-auto md:rounded-bl-md"
          title={showHideMessage}
          onClick={this.toggleSidebar}
        >
          {sidebarHidden && <span>&#11013; </span>}
          {!sidebarHidden && <span>&times; </span>}
          {showHideMessage}
        </button>
        {config && (
          <div className={classes} data-ref={debugSidebarSelector}>
            <Tabs<ConsoleTab>
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'adSetup', label: 'Ad Setup' },
                { id: 'debugging', label: <>Debugging {this.validationCountTag()}</> }
              ]}
              active={activeTab}
              onSelect={tab => this.setState({ activeTab: tab })}
            />
            {activeTab === 'overview' && this.renderOverview(config)}
            {activeTab === 'adSetup' && this.renderAdSetup(config)}
            {activeTab === 'debugging' && this.renderDebugging(config)}
          </div>
        )}
      </div>
    );
  }

  private renderOverview = (config: MoliConfig): React.ReactElement => {
    const { runtimeConfig, labelConfigService } = this.props;
    const { theme } = this.state;

    const configLabel = window.moli.configLabel ?? 'not available';
    const currentConfigVersion = window.moli.getConfig()?.version ?? 'not available';
    const isVersionOverridden =
      resolveOverrides(window, QueryParameters.moliVersion, BrowserStorageKeys.moliVersion).length >
      0;
    const isEnvironmentOverridden = !!getActiveEnvironmentOverride(window);
    const isTestMode = runtimeConfig.environment === 'test';
    const isDarkTheme = theme === 'dark';
    const switchToDarkTheme = () => this.setTheme('dark');
    const switchToLightTheme = () => this.setTheme('light');

    const requestedSlots = config.slots.filter(this.isSlotRendered);

    return (
      <>
        <Block title="Ad Tag" color="moli">
          <TagContainer>
            <TagLabel>Ad tag version</TagLabel>
            <Tag variant="secondary">{window.moli.version}</Tag>
          </TagContainer>
          <TagContainer>
            <TagLabel>Config version</TagLabel>
            <Tag variant={isVersionOverridden ? 'yellow' : 'secondary'}>{currentConfigVersion}</Tag>
            <TextInput
              value={this.state.configVersion}
              placeholder={currentConfigVersion}
              onChange={e => {
                this.setState({ configVersion: e.currentTarget.value });
              }}
            />
            <Btn
              onClick={() => this.overrideConfigVersion(this.state.configVersion)}
              title="Reload"
            >
              load
            </Btn>
            <Btn variant="green" onClick={this.clearConfigVersionOverride} title="Reset">
              reset
            </Btn>
          </TagContainer>
          <TagContainer>
            <TagLabel>Config label</TagLabel>
            <Tag variant="secondary">{configLabel}</Tag>
          </TagContainer>
          <TagContainer>
            <TagLabel>Test mode</TagLabel>
            <Toggle
              checked={isTestMode}
              title={isTestMode ? 'Switch back to production mode' : 'Override environment to test'}
              onChange={checked =>
                checked ? this.overrideEnvironmentToTest() : this.resetEnvironmentOverrides()
              }
            />
            {isTestMode && !isEnvironmentOverridden && (
              <Tag variant="yellow">test environment set in config</Tag>
            )}
          </TagContainer>
          <TagContainer>
            <TagLabel>Appearance</TagLabel>
            {isDarkTheme && (
              <Btn onClick={switchToLightTheme} title="Switch to light theme">
                🌔 dark
              </Btn>
            )}
            {!isDarkTheme && (
              <Btn onClick={switchToDarkTheme} title="Switch to dark theme">
                🌞 light
              </Btn>
            )}
          </TagContainer>
        </Block>

        <Block title="Targeting" color="targeting">
          {config.targeting && (
            <div>
              <SubHeadline>Key/value pairs</SubHeadline>
              {this.keyValues({
                ...config.targeting.keyValues,
                ...runtimeConfig.keyValues
              })}
              <SubHeadline>Labels from publisher</SubHeadline>
              {this.labels([...runtimeConfig.labels, ...(config.targeting?.labels ?? [])])}
              <SubHeadline>Labels from label size config</SubHeadline>
              {this.labels(
                labelConfigService
                  .getSupportedLabels()
                  .filter(l1 => !(config.targeting!.labels || []).find(l2 => l2 === l1))
              )}
            </div>
          )}
          {!config.targeting && <span>No targeting config present.</span>}
        </Block>

        <Block
          title={<>Requested Ad Slots {<Tag variant="grey">{requestedSlots.length}</Tag>}</>}
          color="slots"
        >
          {requestedSlots.length === 0 && <span>No ad slots have been requested.</span>}
          {requestedSlots.map((slot, index) => (
            <TagContainer key={`${slot.domId}-${index}`}>
              <button
                className="d-link p-0 text-left text-sm text-base-content"
                title="Open in Ad Setup"
                onClick={() => this.openSlotInAdSetup(slot.domId)}
              >
                {slot.domId}
              </button>
              <Tag variant="grey">{slot.position}</Tag>
              <Tag variant="transparent">{slot.behaviour.loaded}</Tag>
            </TagContainer>
          ))}
        </Block>
      </>
    );
  };

  private renderAdSetup = (config: MoliConfig): React.ReactElement => {
    const { modules, labelConfigService } = this.props;
    const { showOnlyRenderedSlots, selectedSlotDomId } = this.state;

    return (
      <>
        <Block title="Ad Slots" color="slots">
          <Panel variant="grey">
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
          </Panel>

          <Panel variant="grey">
            <label className="flex select-none items-center gap-2">
              <input
                className="d-checkbox d-checkbox-primary d-checkbox-xs border border-solid border-primary"
                type="checkbox"
                checked={showOnlyRenderedSlots}
                onChange={e =>
                  this.setState({
                    showOnlyRenderedSlots: (e.target as HTMLInputElement).checked
                  })
                }
              />
              Show only rendered slots
            </label>
          </Panel>

          {config.slots.map((slot, index) =>
            this.isSlotRendered(slot) || !showOnlyRenderedSlots ? (
              <div
                key={index}
                ref={el => {
                  if (el && selectedSlotDomId === slot.domId) {
                    el.scrollIntoView({ block: 'start' });
                    this.setState({ selectedSlotDomId: undefined });
                  }
                }}
              >
                <strong>{slot.behaviour.loaded}</strong> slot with DOM ID{' '}
                <strong>{slot.domId}</strong>
                <AdSlotConfig
                  labelConfigService={labelConfigService}
                  slot={slot}
                  initiallyExpanded={selectedSlotDomId === slot.domId}
                />
              </div>
            ) : null
          )}
        </Block>

        <Block title="Label Size Config" color="sizeConfig">
          {config.labelSizeConfig && config.labelSizeConfig.length > 0 && (
            <LabelConfigDebug labelSizeConfig={config.labelSizeConfig} />
          )}
          {(!config.labelSizeConfig || config.labelSizeConfig.length === 0) && (
            <span>No size config present.</span>
          )}
        </Block>

        <Block title="Modules" color="modules">
          {modules && Object.keys(modules).length > 0 ? (
            <ModuleConfigs modules={modules} />
          ) : (
            <span>No modules configured.</span>
          )}
        </Block>

        {config.prebid && (
          <Block title="Prebid" color="prebid">
            <TagContainer>
              <TagLabel>Version</TagLabel>
              {window.pbjs.version ? (
                <Tag>{window.pbjs.version.toString()}</Tag>
              ) : (
                <Tag variant="red">Prebid not found</Tag>
              )}
            </TagContainer>

            <TagContainer>
              <TagLabel>Prebid debug</TagLabel>
              <Tag variant={config.prebid.config.debug ? 'yellow' : undefined}>
                {config.prebid.config.debug ? 'enabled' : 'disabled'}
              </Tag>
            </TagContainer>

            {config.prebid.config.enableSendAllBids !== undefined && (
              <TagContainer>
                <TagLabel>sendAllBids enabled</TagLabel>
                <Tag>{config.prebid.config.enableSendAllBids.toString()}</Tag>
              </TagContainer>
            )}

            {config.prebid.config.bidderTimeout && (
              <TagContainer>
                <TagLabel>Bidder timeout</TagLabel>
                <Tag>{`${config.prebid.config.bidderTimeout.toString()}ms`}</Tag>
              </TagContainer>
            )}

            {config.prebid.config.consentManagement && (
              <div>
                <SubHeadline>Consent management</SubHeadline>
                <TagContainer>
                  <TagLabel>allowAuctionWithoutConsent</TagLabel>
                  <Tag>
                    {(
                      !!config.prebid.config.consentManagement.gdpr?.allowAuctionWithoutConsent ??
                      'true'
                    ).toString()}
                  </Tag>
                </TagContainer>
                {config.prebid.config.consentManagement.gdpr?.cmpApi && (
                  <TagContainer>
                    <TagLabel>CMP API</TagLabel>
                    <Tag>{config.prebid.config.consentManagement.gdpr?.cmpApi ?? 'iab'}</Tag>
                  </TagContainer>
                )}
                <TagContainer>
                  <TagLabel>CMP timeout</TagLabel>
                  <Tag>{`${config.prebid.config.consentManagement.gdpr?.timeout ?? 10000}ms`}</Tag>
                </TagContainer>
              </div>
            )}

            {config.prebid.config.userSync && (
              <div>
                <SubHeadline>User sync</SubHeadline>
                <TagContainer>
                  <TagLabel>Sync enabled</TagLabel>
                  <Tag>
                    {config.prebid.config.userSync.syncEnabled === undefined
                      ? `${window.pbjs
                          .getConfig()
                          .userSync?.syncEnabled?.toString()} (default from prebid config - no value in moli config)`
                      : config.prebid.config.userSync.syncEnabled.toString()}
                  </Tag>
                </TagContainer>
                {config.prebid.config.userSync.syncDelay !== undefined && (
                  <TagContainer>
                    <TagLabel>Sync delay</TagLabel>
                    <Tag>{`${config.prebid.config.userSync.syncDelay}ms`}</Tag>
                  </TagContainer>
                )}
                {config.prebid.config.userSync.syncsPerBidder !== undefined && (
                  <TagContainer>
                    <TagLabel>Syncs per bidder</TagLabel>
                    <Tag>{config.prebid.config.userSync.syncsPerBidder.toString()}</Tag>
                  </TagContainer>
                )}
                <TagContainer>
                  <TagLabel>User sync override enabled</TagLabel>
                  <Tag>{(!!config.prebid.config.userSync.enableOverride).toString()}</Tag>
                </TagContainer>
                {config.prebid.config.userSync.filterSettings && (
                  <div>
                    <h6 className="mt-2 text-xs font-bold">Filter Settings</h6>
                    {config.prebid.config.userSync.filterSettings.all &&
                      this.filterSetting('All', config.prebid.config.userSync.filterSettings.all)}
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

            <SubHeadline>Currency</SubHeadline>
            <TagContainer>
              <TagLabel>Ad server currency</TagLabel>
              <Tag>{config.prebid.config.currency?.adServerCurrency ?? 'EUR (default)'}</Tag>
            </TagContainer>
            <TagContainer>
              <TagLabel>Granularity multiplier</TagLabel>
              <Tag>
                {config.prebid.config.currency?.granularityMultiplier.toString() ?? 'not set'}
              </Tag>
            </TagContainer>
            <TagContainer>
              <TagLabel>Default Rates, USD → EUR</TagLabel>
              <Tag>
                {config.prebid.config.currency?.defaultRates.USD.EUR?.toString() ?? 'not set'}
              </Tag>
            </TagContainer>
          </Block>
        )}

        {config.a9 && (
          <Block title="A9" color="a9">
            <TagContainer>
              <TagLabel>PubID</TagLabel>
              <Tag variant={config.a9.pubID ? 'blue' : 'red'}>{config.a9.pubID}</Tag>
            </TagContainer>
            <TagContainer>
              <TagLabel>Timeout</TagLabel>
              <Tag variant={config.a9.timeout ? 'blue' : 'red'}>
                {config.a9.timeout.toFixed(0)}ms
              </Tag>
            </TagContainer>
            <TagContainer>
              <TagLabel>CMP timeout</TagLabel>
              <Tag variant={config.a9.cmpTimeout ? 'blue' : 'red'}>
                {config.a9.cmpTimeout.toFixed(0)}ms
              </Tag>
            </TagContainer>
          </Block>
        )}
      </>
    );
  };

  private renderDebugging = (config: MoliConfig): React.ReactElement => {
    const { runtimeConfig } = this.props;
    const { adstxtEntry, adstxtDomain, adDensity } = this.state;

    const interstitialSlot = window.moli
      .getConfig()
      ?.slots.find(slot => slot.position === 'interstitial');
    const isEnvironmentOverridden = !!getActiveEnvironmentOverride(window);
    const interstitialTestKey = 'test-interstitial';
    const isInterstitialTestEnabled = !!getBrowserStorageValue(interstitialTestKey, localStorage);
    const debugDelay = getDebugDelayFromLocalStorage(window);

    return (
      <>
        <Block title="Tools" color="moli">
          <TagContainer>
            <TagLabel>Show slot overlays</TagLabel>
            <Toggle
              checked={this.props.showOverlays}
              title="Render the slot configuration as overlays on the page"
              onChange={show => this.props.onShowOverlaysChange(show)}
            />
          </TagContainer>
          {interstitialSlot && (
            <TagContainer>
              <TagLabel>Interstitital Test Mode</TagLabel>
              {isInterstitialTestEnabled ? (
                <Btn
                  variant="green"
                  onClick={() => {
                    removeBrowserStorageValue(interstitialTestKey, localStorage);
                    this.refreshInterstitial(interstitialSlot);
                  }}
                >
                  ◀ Reset interstitial test
                </Btn>
              ) : (
                <Btn
                  variant="yellow"
                  onClick={() => {
                    setBrowserStorageValue(interstitialTestKey, 'true', localStorage);
                    this.refreshInterstitial(interstitialSlot);
                  }}
                  disabled={!isEnvironmentOverridden}
                >
                  ▶ Test interstitial
                </Btn>
              )}
              {!isEnvironmentOverridden && (
                <p className="mt-2 max-w-md">
                  ❗️Please activate the test mode (Overview tab) before testing the interstitial.
                </p>
              )}
            </TagContainer>
          )}
          <TagContainer>
            <TagLabel>Delay loading ads (only in test environment)</TagLabel>
            <TextInput
              type="number"
              placeholder="in milliseconds"
              value={debugDelay}
              list="debug-delay-suggestions"
              disabled={runtimeConfig.environment !== 'test'}
              onChange={e => setDebugDelayToLocalStorage(window, e.currentTarget.valueAsNumber)}
            />
            <datalist id="debug-delay-suggestions">
              <option value={500} />
              <option value={1000} />
              <option value={2000} />
              <option value={3000} />
            </datalist>
          </TagContainer>
          <TagContainer>
            <Btn
              variant="blue"
              onClick={() => {
                config.slots.forEach(removeTestSlotSizeFromLocalStorage);
                window.location.reload();
              }}
            >
              ▶ Reset all test slot sizes
            </Btn>
          </TagContainer>
        </Block>

        <Block title="Consent" color="consent">
          <ConsentConfig />
        </Block>

        <Block title="Supply Chain" color="supplyChain">
          <TagContainer>
            <TagLabel>Seller ID (ads.txt)</TagLabel>
            <Tag
              variant={adstxtEntry[1] === config?.schain.supplyChainStartNode.sid ? 'green' : 'red'}
            >
              {adstxtEntry[1]}
            </Tag>
          </TagContainer>
          <TagContainer>
            <TagLabel>Status</TagLabel>
            <Tag variant={adstxtEntry[2] ? 'blue' : 'red'}>{adstxtEntry[2]}</Tag>
          </TagContainer>
          <p className="mt-2 max-w-md">
            {config?.schain.supplyChainStartNode.sid === adstxtEntry[1]
              ? `✅ Seller ids in ad tag config and ads.txt of domain ${adstxtDomain} are matching!`
              : `❗️Seller ids in ad tag config (${config?.schain.supplyChainStartNode.sid}) and ads.txt of current domain (${adstxtDomain}, ${adstxtEntry[1]}) are different!`}
          </p>
          {this.state.adstxtError !== '' && (
            <Panel variant="red">{`${this.state.adstxtError} If you use this console locally or on the demo page, try to enable CORS by using a CORS unblocking browser extension.`}</Panel>
          )}
          <form
            className="mb-2 mt-2 flex max-w-md flex-col gap-2 rounded-md bg-[#edf6fc] p-2 text-black"
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
              <TextInput placeholder="Enter new domain" name="newDomain" id="newDomain" />
              <Btn type="submit">Go!</Btn>
            </div>
          </form>
        </Block>

        <Block title="Ad Density" color="adDensity">
          <form
            className="mb-2 mt-2 flex max-w-md flex-col gap-2 rounded-md bg-[#edf6fc] p-2 text-black"
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
            <label htmlFor="adDensitySelector">Calculate ad density of the content element</label>
            <div>
              <TextInput
                placeholder="Enter CSS selector"
                name="adDensitySelector"
                id="adDensitySelector"
              />
              <Btn type="submit">Go!</Btn>
            </div>
          </form>
          <TagContainer>
            <TagLabel>Ad Density</TagLabel>
            <Tag variant={'green'}>{adDensity.totalAdDensity}</Tag>
          </TagContainer>
          {adDensity.percentagePerSlot.length > 0 && (
            <>
              <SubHeadline>Percentage of ad slot area on total ad area</SubHeadline>
              {adDensity.percentagePerSlot.map(percentage => {
                return (
                  <TagContainer key={percentage.adSlotId}>
                    <TagLabel>{extractPositionFromPath(percentage.adSlotId)}</TagLabel>
                    <Tag variant={'green'}>{percentage.percentage}%</Tag>
                  </TagContainer>
                );
              })}
            </>
          )}
        </Block>

        <Block title={<>Validation {this.validationCountTag()}</>} color="validation">
          <div className="flex max-w-md flex-col gap-1">
            {this.state.messages.length === 0 && (
              <div className="d-alert d-alert-success rounded-md px-2 py-1 text-sm">
                <span>✔ No configuration issues found</span>
              </div>
            )}
            {this.state.messages.map((message, index) => (
              <div
                key={index}
                className={classList(
                  'd-alert rounded-md px-2 py-1 text-sm',
                  [message.kind === 'error', 'd-alert-error'],
                  [message.kind === 'warning', 'd-alert-warning'],
                  [message.kind === 'optimization', 'd-alert-info']
                )}
              >
                <span>{message.text}</span>
              </div>
            ))}
          </div>
        </Block>
      </>
    );
  };

  public listener = (): void => {
    this.setState({ browserResized: true });
  };

  public componentWillUnmount = (): void => {
    this.props.windowResizeService.unregister(this);
  };

  private validationCountTag = (): React.ReactElement => (
    <Tag
      variant={
        this.state.messages.some(m => m.kind === 'error')
          ? 'red'
          : this.state.messages.length > 0
            ? 'yellow'
            : 'green'
      }
    >
      {this.state.messages.length}
    </Tag>
  );

  private openSlotInAdSetup = (domId: string): void => {
    this.setState({ activeTab: 'adSetup', selectedSlotDomId: domId });
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

  private setTheme = (theme: Theme) =>
    this.setState({ theme }, () => this.props.themingService.applyTheme(theme));

  private keyValues = (keyValues: googleAdManager.KeyValueMap): React.ReactElement => {
    const properties = Object.keys(keyValues);

    return properties.length > 0 ? (
      <table className="d-table d-table-xs w-auto text-left">
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
      <div className="mt-2 flex flex-wrap items-center gap-y-1">
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
        <TagContainer>
          <TagLabel>Bidders</TagLabel>
          {filterSetting.bidders === '*'
            ? this.standardTagFromString('all')
            : filterSetting.bidders.map(this.standardTagFromString)}
        </TagContainer>
        <TagContainer>
          <TagLabel>Include/exclude</TagLabel>
          {this.standardTagFromString(filterSetting.filter)}
        </TagContainer>
      </div>
    );
  };

  private standardTagFromString = (content: string): React.ReactElement => {
    return <Tag key={content}>{content}</Tag>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
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
