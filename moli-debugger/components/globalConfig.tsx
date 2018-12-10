import * as preact from 'preact';

import { classList } from '../util/stringUtils';
import { AdSlotConfig } from './adSlotConfig';

import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { SizeConfigService } from 'moli-ad-tag/source/ts/ads/sizeConfigService';

import MoliConfig = Moli.MoliConfig;
import DfpSlotSize = Moli.DfpSlotSize;

type IGlobalConfigProps = {
  config?: MoliConfig;
  sizeConfigService: SizeConfigService;
};
type IGlobalConfigState = {
  sidebarHidden: boolean;
  expandSection: {
    slots: boolean;
    targeting: boolean;
    prebid: boolean;
    sizeConfig: boolean;
  };
  messages: Array<Message>;
};

type Message = {
  kind: 'error' | 'warning';
  text: string | JSX.Element;
};
type TagVariant = 'green' | 'red' | 'yellow';

const debugSidebarSelector = 'moli-debug-sidebar';

export class GlobalConfig extends preact.Component<IGlobalConfigProps, IGlobalConfigState> {

  constructor(props: IGlobalConfigProps) {
    super();
    this.state = {
      sidebarHidden: false,
      expandSection: {
        slots: false,
        targeting: true,
        prebid: true,
        sizeConfig: true
      },
      messages: []
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

        <div class="MoliDebug-sidebarSection">
          <h4>
            {this.collapseToggle('slots')}
            Slots
          </h4>

          {this.state.expandSection.slots && <div>
            {config.slots.map(slot =>
              <div>
                <strong>{slot.behaviour}</strong> slot with DOM ID <strong>{slot.domId}</strong>
                <AdSlotConfig sizeConfigService={props.sizeConfigService} slot={slot}/>
              </div>
            )}
          </div>}

        </div>

        <h4>
          {this.collapseToggle('targeting')}
          Targeting
        </h4>

        {this.state.expandSection.targeting && <div class="MoliDebug-sidebarSection">
          {config.targeting && <div>
            <h5>Key/value pairs</h5>
            {this.keyValues(config.targeting.keyValues)}
            {this.labels(config.targeting.labels)}
          </div>}
          {!config.targeting && <span>No targeting config present.</span>}
        </div>}

        <h4>
          {this.collapseToggle('sizeConfig')}
          Size config
        </h4>

        {this.state.expandSection.sizeConfig && <div class="MoliDebug-sidebarSection">
          {(config.sizeConfig && config.sizeConfig.length > 0) && this.sizeConfig(config.sizeConfig)}
          {(!config.sizeConfig || config.sizeConfig.length === 0) && <span>No size config present.</span>}
        </div>}

        {config.prebid && <div class="MoliDebug-sidebarSection">

          <h4>
            {this.collapseToggle('prebid')}
            Prebid
          </h4>

          {this.state.expandSection.prebid && <div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Prebid debug</span>
              {this.tagFromString(config.prebid.config.debug ? 'enabled' : 'disabled', config.prebid.config.debug ? 'yellow' : undefined)}
            </div>

            {config.prebid.config.enableSendAllBids !== undefined && <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">sendAllBids enabled</span>
              {this.tagFromString(config.prebid.config.enableSendAllBids.toString())}
            </div>}

            {config.prebid.config.bidderTimeout &&
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Bidder timeout</span>
              {this.tagFromString(`${config.prebid.config.bidderTimeout.toString()}ms`)}
            </div>}

            {config.prebid.config.consentManagement && <div>
              <h5>Consent management</h5>
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">allowAuctionWithoutConsent</span>
                {this.tagFromString((!!config.prebid.config.consentManagement.allowAuctionWithoutConsent).toString())}
              </div>
              {config.prebid.config.consentManagement.cmpApi && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">CMP API</span>
                {this.tagFromString(config.prebid.config.consentManagement.cmpApi)}
              </div>}
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">CMP timeout</span>
                {this.tagFromString(`${config.prebid.config.consentManagement.timeout}ms`)}
              </div>
            </div>}

            {config.prebid.config.userSync && <div>
              <h5>User sync</h5>
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Sync enabled</span>
                {this.tagFromString((!!config.prebid.config.userSync.syncEnabled).toString())}
              </div>
              {config.prebid.config.userSync.syncDelay !== undefined && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Sync delay</span>
                {this.tagFromString(`${config.prebid.config.userSync.syncDelay}ms`)}
              </div>}
              {config.prebid.config.userSync.syncsPerBidder !== undefined && <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">Syncs per bidder</span>
                {this.tagFromString(config.prebid.config.userSync.syncsPerBidder.toString())}
              </div>}
              <div class="MoliDebug-tagContainer">
                <span class="MoliDebug-tagLabel">User sync override enabled</span>
                {this.tagFromString((!!config.prebid.config.userSync.enableOverride).toString())}
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
              {this.tagFromString(config.prebid.config.currency.adServerCurrency)}
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Granularity multiplier</span>
              {this.tagFromString(config.prebid.config.currency.granularityMultiplier.toString())}
            </div>
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Default Rates, USD → EUR</span>
              {this.tagFromString(config.prebid.config.currency.defaultRates.USD.EUR.toString())}
            </div>

            {/* TODO: bidder settings - do we need to display something here? */}
          </div>}
        </div>}

        <h4>Consent</h4>
        <div class="MoliDebug-sidebarSection">
          {this.consent(config.consent)}
        </div>

        <h4>Moli configuration issues and warnings</h4>
        <div class="MoliDebug-sidebarSection">
          {this.state.messages.map(message => <div class={classList('MoliDebug-configMessage', `MoliDebug-configMessage--${message.kind}`)}>
            {this.iconForMessageKind(message.kind)}
            {message.text}
          </div>)}
        </div>
      </div>}
    </div>;
  }

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
          const value = keyValues[key];

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
      <span class="MoliDebug-tagLabel">Labels</span>
      {labels && labels.map(this.standardTagFromString)}
      {(!labels || labels.length === 0) && <span>No labels config present.</span>}
    </div>;
  };

  private sizeConfig = (sizeConfig: Moli.SizeConfigEntry[]): JSX.Element => {
    return <div>
      {sizeConfig.map((sizeConfigEntry, idx) => {
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
            <div class="MoliDebug-tagContainer">
              <span class="MoliDebug-tagLabel">Labels</span>
              {sizeConfigEntry.labels.map(this.standardTagFromString)}
            </div>
          </div>;
        }
      )}
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

  private tagFromSlotSize = (slotSize: DfpSlotSize): JSX.Element => {
    return this.tagFromString(
      slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`
    );
  };

  private standardTagFromString = (content: string): JSX.Element => {
    return this.tagFromString(content);
  };

  private tagFromString = (content: string, variant?: TagVariant): JSX.Element => {
    return <div class={classList('MoliDebug-tag', [ !!variant, `MoliDebug-tag--${variant}` ])}>{content}</div>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
  };

  private consent = (consent: Moli.consent.ConsentConfig): JSX.Element => {
    const provider = <div class="MoliDebug-tagContainer">
      <span class="MoliDebug-tagLabel">Provider</span>
      {this.tagFromString(consent.personalizedAds.provider)}
    </div>;

    switch (consent.personalizedAds.provider) {
      case 'cmp':
        return provider;
      case 'static':
        return <div>
          {provider}
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Value</span>
            {this.tagFromString(consent.personalizedAds.value.toString())}
          </div>
        </div>;
      case 'cookie':
        return <div>
          {provider}
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Cookie</span>
            {this.tagFromString(consent.personalizedAds.cookie)}
          </div>
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Cookie value for nonPersonalizedAds</span>
            {this.tagFromString(consent.personalizedAds.valueForNonPersonalizedAds)}
          </div>
        </div>;
    }
  };

  private collapseToggle = (section: keyof Pick<IGlobalConfigState['expandSection'], 'slots' | 'targeting' | 'prebid' | 'sizeConfig'>): JSX.Element => {
    const toggleValue = (section: keyof Pick<IGlobalConfigState['expandSection'], 'slots' | 'targeting' | 'prebid' | 'sizeConfig'>) => {
      const oldVal = this.state.expandSection[section];
      this.setState({ expandSection: { ...this.state.expandSection, [section]: !oldVal } });
    };
    return <button class="MoliDebug-adSlot-button"
                   title={`${this.state.expandSection[section] ? 'collapse' : 'expand'} ${section}`}
                   onClick={() => toggleValue(section)}>{this.state.expandSection[section] ? '⊖' : '⊕'}</button>;
  };

  private iconForMessageKind = (kind: 'error' | 'warning'): JSX.Element => {
    return <span class="MoliDebug-configMessage-icon">{kind === 'error' ? <span>&#2716;</span> : <span>&#9888;</span>}</span>;
  };

  private reportMissingConfig = (messages: Array<Message>): void => {
    messages.push({
      kind: 'error',
      text: 'No moli config found.'
    });
  };

  private checkForDuplicateOrMissingSlots = (messages: Array<Message>, slot: Moli.AdSlot): void => {
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

  private checkConsentConfig = (messages: Array<Message>, consent?: Moli.consent.ConsentConfig): void => {
    if (!consent) {
      messages.push({
        kind: 'error',
        text: 'No consent configuration found.'
      });
    }
  };

  private checkPrebidConfig = (messages: Array<Message>, prebid: Moli.headerbidding.PrebidConfig) => {
    if (!prebid.config.consentManagement) {
      messages.push({
        kind: 'error',
        text: 'No prebid consentManagement configuration found.'
      });
    }
  };

  private checkSlotPrebidConfig = (messages: Array<Message>, slot: Moli.AdSlot) => {
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
}
