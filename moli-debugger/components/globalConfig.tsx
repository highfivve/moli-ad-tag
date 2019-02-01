import * as preact from 'preact';
import { ReportingService } from '../../source/ts/ads/reportingService';

import { AdSlotConfig } from './adSlotConfig';
import { SizeConfigDebug } from './sizeConfigDebug';
import { Tag } from './tag';
import { classList, firstUpper } from '../util/stringUtils';
import { IWindowEventObserver, WindowResizeService } from '../util/windowResizeService';

import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';
import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import MoliConfig = Moli.MoliConfig;
import AdSlot = Moli.AdSlot;

type IGlobalConfigProps = {
  config?: MoliConfig;
  sizeConfigService: SizeConfigService;
  windowResizeService: WindowResizeService;
};
type IGlobalConfigState = {
  sidebarHidden: boolean;
  expandSection: {
    slots: boolean;
    targeting: boolean;
    prebid: boolean;
    a9: boolean,
    sizeConfig: boolean;
    performance: boolean;
  };
  messages: Message[];
  browserResized: boolean;
  showOnlyRenderedSlots: boolean;
};

type Message = {
  kind: 'error' | 'warning';
  text: string | JSX.Element;
};

const debugSidebarSelector = 'moli-debug-sidebar';

export class GlobalConfig extends preact.Component<IGlobalConfigProps, IGlobalConfigState> implements IWindowEventObserver {

  constructor(props: IGlobalConfigProps) {
    super();
    this.state = {
      sidebarHidden: false,
      expandSection: {
        slots: false,
        targeting: true,
        prebid: false,
        a9: false,
        sizeConfig: false,
        performance: true
      },
      messages: [],
      browserResized: false,
      showOnlyRenderedSlots: false
    };

    if (!props.config) {
      this.reportMissingConfig(this.state.messages);
    } else {
      props.config.slots.forEach(slot => {
        this.checkForDuplicateOrMissingSlots(this.state.messages, slot);
        this.checkSlotPrebidConfig(this.state.messages, slot);
      });

      this.checkConsentConfig(this.state.messages, props.config.consent);

      if (props.config.prebid) {
        this.checkPrebidConfig(this.state.messages, props.config.prebid);
      }

      if (props.config.sizeConfig) {
        props.config.sizeConfig.forEach(this.checkGlobalSizeConfigEntry(this.state.messages));
      }

      props.windowResizeService.register(this);
    }
  }

  render(props: IGlobalConfigProps, state: IGlobalConfigState): JSX.Element {
    const classes = classList('MoliDebug-sidebar', [ this.state.sidebarHidden, 'is-hidden' ]);
    const config = props.config;
    const showHideMessage = `${state.sidebarHidden ? 'Show' : 'Hide'} moli global config panel`;

    return <div>
      <button class="MoliDebug-sidebar-closeHandle"
              title={showHideMessage} onClick={this.toggleSidebar}>
        {state.sidebarHidden && <span>&#11013; </span>}
        {!state.sidebarHidden && <span>&times; </span>}
        {showHideMessage}
      </button>
      {config && <div class={classes} data-ref={debugSidebarSelector}>

        <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--slots">
          <h4>
            {this.collapseToggle('slots')}
            Slots
          </h4>

          {this.state.expandSection.slots && <div>
            <p class="MoliDebug-panel MoliDebug-panel--grey">
              Slot sizes are annotated to show the origin of their validation state:
              <ul>
                <li><strong>Ⓢ</strong> means that the validation originates from the <strong>slot's own
                  sizeConfig</strong>,
                </li>
                <li><strong>Ⓖ</strong> indicates that the validation was done using the <strong>global
                  sizeConfig</strong>.
                </li>
              </ul>
            </p>

            <p class="MoliDebug-panel MoliDebug-panel--grey">
              <label class="MoliDebug-checkBox">
                <input type="checkbox"
                       onChange={e => this.setState({ showOnlyRenderedSlots: (e.target as HTMLInputElement).checked })}/>
                Show only rendered slots
              </label>
            </p>

            {config.slots.map(slot => (this.isSlotRendered(slot) || !state.showOnlyRenderedSlots) ?
              <div>
                <strong>{slot.behaviour}</strong> slot with DOM ID <strong>{slot.domId}</strong>
                <AdSlotConfig sizeConfigService={props.sizeConfigService} slot={slot}/>
              </div> : null
            )}
          </div>}

        </div>

        <div className="MoliDebug-sidebarSection  MoliDebug-sidebarSection--targeting">
          <h4>
            {this.collapseToggle('targeting')}
            Targeting
          </h4>

          {this.state.expandSection.targeting && <div>
            {config.targeting && <div>
              <h5>Key/value pairs</h5>
              {this.keyValues(config.targeting.keyValues)}
              <h5>Labels from publisher</h5>
              {this.labels(config.targeting.labels)}
              <h5>Labels from size config</h5>
              {this.labels(props.sizeConfigService.getSupportedLabels().filter(l1 => !(config.targeting!.labels || []).find(l2 => l2 === l1)))}
            </div>}
            {!config.targeting && <span>No targeting config present.</span>}
          </div>}
        </div>

        <div className="MoliDebug-sidebarSection MoliDebug-sidebarSection--sizeConfig">
          <h4>
            {this.collapseToggle('sizeConfig')}
            Size config
          </h4>

          {this.state.expandSection.sizeConfig && <div>
            {(config.sizeConfig && config.sizeConfig.length > 0) && <SizeConfigDebug sizeConfig={config.sizeConfig}/>}
            {(!config.sizeConfig || config.sizeConfig.length === 0) && <span>No size config present.</span>}
          </div>}
        </div>

        {config.prebid && <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--prebid">

          <h4>
            {this.collapseToggle('prebid')}
            Prebid
          </h4>

          {this.state.expandSection.prebid && <div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Prebid debug</span>
              <Tag
                variant={config.prebid.config.debug ? 'yellow' : undefined}>{config.prebid.config.debug ? 'enabled' : 'disabled'}</Tag>
            </div>

            {config.prebid.config.enableSendAllBids !== undefined && <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">sendAllBids enabled</span>
              <Tag>{config.prebid.config.enableSendAllBids.toString()}</Tag>
            </div>}

            {config.prebid.config.bidderTimeout &&
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Bidder timeout</span>
              <Tag>{`${config.prebid.config.bidderTimeout.toString()}ms`}</Tag>
            </div>}

            {config.prebid.config.consentManagement && <div>
              <h5>Consent management</h5>
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">allowAuctionWithoutConsent</span>
                <Tag>{(!!config.prebid.config.consentManagement.allowAuctionWithoutConsent).toString()}</Tag>
              </div>
              {config.prebid.config.consentManagement.cmpApi && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">CMP API</span>
                <Tag>{config.prebid.config.consentManagement.cmpApi}</Tag>
              </div>}
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">CMP timeout</span>
                <Tag>{`${config.prebid.config.consentManagement.timeout}ms`}</Tag>
              </div>
            </div>}

            {config.prebid.config.userSync && <div>
              <h5>User sync</h5>
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Sync enabled</span>
                <Tag>{(config.prebid.config.userSync === undefined ? true : !!config.prebid.config.userSync.syncEnabled).toString()}</Tag>
              </div>
              {config.prebid.config.userSync.syncDelay !== undefined && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Sync delay</span>
                <Tag>{`${config.prebid.config.userSync.syncDelay}ms`}</Tag>
              </div>}
              {config.prebid.config.userSync.syncsPerBidder !== undefined && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Syncs per bidder</span>
                <Tag>{config.prebid.config.userSync.syncsPerBidder.toString()}</Tag>
              </div>}
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">User sync override enabled</span>
                <Tag>{(!!config.prebid.config.userSync.enableOverride).toString()}</Tag>
              </div>
              {config.prebid.config.userSync.filterSettings && <div>
                <h6>Filter Settings</h6>
                {config.prebid.config.userSync.filterSettings.all && this.filterSetting('All', config.prebid.config.userSync.filterSettings.all)}
                {config.prebid.config.userSync.filterSettings.iframe && this.filterSetting('iFrame', config.prebid.config.userSync.filterSettings.iframe)}
                {config.prebid.config.userSync.filterSettings.image && this.filterSetting('Image', config.prebid.config.userSync.filterSettings.image)}
              </div>}
            </div>}

            <h5>Currency</h5>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Ad server currency</span>
              <Tag>{config.prebid.config.currency.adServerCurrency}</Tag>
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Granularity multiplier</span>
              <Tag>{config.prebid.config.currency.granularityMultiplier.toString()}</Tag>
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Default Rates, USD → EUR</span>
              <Tag>{config.prebid.config.currency.defaultRates.USD.EUR.toString()}</Tag>
            </div>
          </div>}
        </div>}

        {config.a9 && <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--a9">
          <h4>
            {this.collapseToggle('a9')}
            A9
          </h4>

          {this.state.expandSection.a9 && <div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">PubID</span>
              <Tag
                variant={config.a9.pubID ? 'blue' : 'red'}>{config.a9.pubID}</Tag>
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Timeout</span>
              <Tag
                variant={config.a9.timeout ? 'blue' : 'red'}>{config.a9.timeout.toFixed(0)}ms</Tag>
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">CMP timeout</span>
              <Tag
                variant={config.a9.cmpTimeout ? 'blue' : 'red'}>{config.a9.cmpTimeout.toFixed(0)}ms</Tag>
            </div>
          </div>}
        </div>
        }

        <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--consent">
          <h4>Consent</h4>
          {this.consent(config.consent)}
        </div>

        {<div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--performance">
          <h4>
            {this.collapseToggle('performance')}
            A9
          </h4>

          {this.state.expandSection.performance && <div>
            {this.singlePerformanceMeasure('ttfa')}
            {this.singlePerformanceMeasure('ttfr')}
            {this.singlePerformanceMeasure('prebidLoad')}
            {this.singlePerformanceMeasure('a9Load')}
            {this.singlePerformanceMeasure('dfpLoad')}
          </div>}
        </div>
        }

        <div class="MoliDebug-sidebarSection MoliDebug-sidebarSection--linting">
        <h4>Moli configuration issues and warnings</h4>
          {this.state.messages.map(message => <div
            class={classList('MoliDebug-configMessage', `MoliDebug-configMessage--${message.kind}`)}>
            {this.iconForMessageKind(message.kind)}
            {message.text}
          </div>)}
          {this.state.messages.length === 0 &&
          <div className={classList('MoliDebug-configMessage', `MoliDebug-configMessage--empty`)}>
            {this.iconForMessageKind('empty')}
            No errors or warnings found. You're all set!
          </div>}
        </div>
      </div>}
    </div>;
  }

  public listener = (): void => {
    this.setState({ browserResized: true });
  };

  public componentWillUnmount = (): void => {
    this.props.windowResizeService.unregister(this);
  };

  private keyValues = (keyValues: Moli.DfpKeyValueMap): JSX.Element => {
    const properties = Object.keys(keyValues);

    return properties.length > 0 ? <table class="MoliDebug-keyValueTable">
        <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
        </thead>
        <tbody>
        {properties.map((key: string) => {
          const value = keyValues[ key ];

          return <tr>
            <td>{key}</td>
            <td>{Array.isArray(value) ? value.map(this.standardTagFromString) : this.standardTagFromString(value!)}</td>
          </tr>;
        })}
        </tbody>
      </table> :
      <span>No key/values config present.</span>;
  };

  private labels = (labels: string[] | undefined): JSX.Element => {
    return <div class="MoliDebug-tagContainer">
      {labels && labels.map(label => <Tag variant="blue" spacing="medium">{label}</Tag>)}
      {(!labels || labels.length === 0) && <span>No labels present.</span>}
    </div>;
  };

  private filterSetting = (name: string, filterSetting: prebidjs.IFilterSetting): JSX.Element => {
    return <div>
      <strong>{name}</strong>
      <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Bidders</span>
        {filterSetting.bidders.map(this.standardTagFromString)}
      </div>
      <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">Include/exclude</span>
        {this.standardTagFromString(filterSetting.filter)}
      </div>
    </div>;
  };

  private standardTagFromString = (content: string): JSX.Element => {
    return <Tag>{content}</Tag>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
  };

  private consent = (consent: Moli.consent.ConsentConfig): JSX.Element => {
    const provider = <div class="MoliDebug-tagContainer">
      <span class="MoliDebug-tagLabel">Provider</span>
      <Tag>{consent.personalizedAds.provider}</Tag>
    </div>;

    switch (consent.personalizedAds.provider) {
      case 'cmp':
        return <div>
          {provider}
          <div class="MoliDebug-tagContainer">
            <span className="MoliDebug-tagLabel">Available</span>
            <Tag variant={this.isCmpFunctionAvailable() ? 'green' : 'red'}>{this.isCmpFunctionAvailable().toString()}</Tag>
          </div>
        </div>;
      case 'static':
        return <div>
          {provider}
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Value</span>
            <Tag>{consent.personalizedAds.value.toString()}</Tag>
          </div>
        </div>;
      case 'cookie':
        return <div>
          {provider}
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Cookie</span>
            <Tag>{consent.personalizedAds.cookie}</Tag>
          </div>
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Cookie value for nonPersonalizedAds</span>
            <Tag>{consent.personalizedAds.valueForNonPersonalizedAds}</Tag>
          </div>
        </div>;
    }
  };

  private singlePerformanceMeasure = (name: 'dfpLoad' | 'prebidLoad' | 'a9Load' | 'ttfa' | 'ttfr'): JSX.Element => {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName(name);
    const results = window.performance.getEntriesByName(measure, 'measure');
    const entry = results[0];
    if (entry) {
      const color: 'green' | 'yellow' | 'red' = entry.duration > 5000 ? 'red' : (entry.duration > 2000 ?  'yellow' : 'green');
      return <div className="MoliDebug-tagContainer">
        <span className="MoliDebug-tagLabel">{name}</span>
        <Tag variant={color}>{entry.duration.toFixed(0)} ms</Tag>
      </div>;
    }
    return <div className="MoliDebug-tagContainer">
      <span className="MoliDebug-tagLabel">{name}</span>
      <Tag variant="blue">no entry</Tag>
    </div>;
  };

  private collapseToggle = (section: keyof Pick<IGlobalConfigState['expandSection'], 'slots' | 'targeting' | 'prebid' | 'a9' | 'sizeConfig' | 'performance'>): JSX.Element => {
    const toggleValue = (section: keyof Pick<IGlobalConfigState['expandSection'], 'slots' | 'targeting' | 'prebid' | 'a9' | 'sizeConfig' | 'performance'>) => {
      const oldVal = this.state.expandSection[ section ];
      this.setState({ expandSection: { ...this.state.expandSection, [ section ]: !oldVal } });
    };
    return <button class="MoliDebug-adSlot-button"
                   title={`${this.state.expandSection[ section ] ? 'collapse' : 'expand'} ${section}`}
                   onClick={() => toggleValue(section)}>{this.state.expandSection[ section ] ? '⊖' : '⊕'}</button>;
  };

  private iconForMessageKind = (kind: Message['kind'] | 'empty'): JSX.Element => {
    return <span className="MoliDebug-configMessage-icon">
      {kind === 'error' && <span>&#x2757;</span>}
      {kind === 'warning' && <span>&#x26A0;</span>}
      {kind === 'empty' && <span>✔</span>}
    </span>;
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
        text: <span>{count} DOM elements with id <strong>{slot.domId}</strong> found. This may lead to unexpected results.</span>
      });
    }

    if (count === 0) {
      messages.push({
        kind: 'warning',
        text: <span>No DOM element with id <strong>{slot.domId}</strong> found. Slot will not be rendered.</span>
      });
    }
  };

  private checkConsentConfig = (messages: Message[], consent?: Moli.consent.ConsentConfig): void => {
    if (!consent) {
      messages.push({
        kind: 'error',
        text: 'No consent configuration found.'
      });
    }

    // if cmp is configured, there must be a cmp present
    if (consent && consent.personalizedAds.provider === 'cmp' && !this.isCmpFunctionAvailable()) {
      messages.push({
        kind: 'error',
        text: 'no window.__cmp function found. Consent management and ads will not work!'
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
  };

  private checkSlotPrebidConfig = (messages: Message[], slot: AdSlot) => {
    if (slot.prebid) {
      const prebidConfig = typeof slot.prebid === 'function' ? slot.prebid({ keyValues: {} }) : slot.prebid,
        mediaTypes = prebidConfig.adUnit.mediaTypes;

      if (!!mediaTypes && !mediaTypes.banner && !mediaTypes.video) {
        messages.push({
          kind: 'error',
          text: `Prebidjs mediaTypes for slot ${slot.domId} | ${slot.adUnitPath} is empty.`
        });
      }
    }
  };
  
  private checkGlobalSizeConfigEntry = (messages: Message[]) =>  (entry: Moli.SizeConfigEntry, index: number): void => {
    if (entry.sizesSupported.length > 0) {
      messages.push({
        kind: 'warning',
        text: `Global SizeConfig entry #${index + 1} adds supportedSizes. We recommend defining supportedSizes per slot in a slot specific SizeConfig`
      });
    }
  };

  private isSlotRendered = (slot: AdSlot): boolean => !!document.getElementById(slot.domId)
    && this.props.sizeConfigService.filterSlot(slot);

  private isCmpFunctionAvailable = () => window.__cmp || typeof window.__cmp === 'function';
}
