import * as preact from 'preact';

import { Tag } from './tag';

import { Moli } from 'ad-tag';
import { ConsentString } from 'consent-string';
import { IABConsentManagement } from 'ad-tag/source/ts/types/IABConsentManagement';
import IConsentData = IABConsentManagement.IConsentData;

type IConsentConfigProps = {
  consent: Moli.consent.ConsentConfig
  consentConfig: Moli.consent.CmpConfigVariants
};

type IConsentConfigState = {
  consentData: IConsentData | undefined,
  vendorListVersion: number | undefined,
  numAllowedVendors: number | undefined,
  allowedPurposes: number[],
  messages: Message[];
};

type Message = {
  kind: 'error' | 'warning';
  text: string | JSX.Element;
};

export class ConsentConfig extends preact.Component<IConsentConfigProps, IConsentConfigState> {

  constructor(props: IConsentConfigProps) {
    super();
    this.state = {
      consentData: undefined,
      vendorListVersion: undefined,
      numAllowedVendors: undefined,
      allowedPurposes: [],
      messages: []
    };
    this.checkConsentConfig(this.state.messages, props.consent);
    this.getConsentData();
  }

  render(props: IConsentConfigProps, state: IConsentConfigState): JSX.Element {
    return <div>
      {this.consent(props.consent)}
      {this.consentConfig(props.consentConfig)}
      {this.consentData()}
    </div>;
  }

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
            <Tag
              variant={this.isCmpFunctionAvailable() ? 'green' : 'red'}>{this.isCmpFunctionAvailable() ? 'true' : 'false'}</Tag>
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

  private consentConfig = (consentConfig: Moli.consent.CmpConfigVariants | undefined): JSX.Element | undefined => {
    if (consentConfig) {
      const cmpProvider = <div class="MoliDebug-tagContainer">
        <span class="MoliDebug-tagLabel">CMP Provider</span>
        <Tag>{consentConfig.provider}</Tag>
      </div>;

      switch (consentConfig.provider) {
        case 'publisher':
          return cmpProvider;
        case 'faktor':
          return <div>
            {cmpProvider}
            <div className="MoliDebug-tagContainer">
              <span className="MoliDebug-tagLabel">auto-opt-in</span>
              <Tag>{consentConfig.autoOptIn.toString()}</Tag>
            </div>
          </div>;
      }
    }
  };

  private getConsentData = (): void => {
    if (this.isCmpFunctionAvailable()) {
      window.__cmp('getConsentData', null, (consentData: IConsentData | null, _success) => {

        const consentString = new ConsentString(consentData ? consentData.consentData : undefined);

        this.setState({ consentData: consentData ? consentData : undefined });
        this.setState({ vendorListVersion: consentString.getVendorListVersion() });
        this.setState({ numAllowedVendors: consentString.getVendorsAllowed().length });
        this.setState({ allowedPurposes: consentString.getPurposesAllowed() });
      });
    }
  };

  private consentData = (): JSX.Element | undefined => {
    if (this.isCmpFunctionAvailable()) {

      return <div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">vendor list version</span>
          <Tag>{this.state.vendorListVersion ? this.state.vendorListVersion.toString() : 'not found'}</Tag>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">num vendors allowed</span>
          <Tag>{this.state.numAllowedVendors ? this.state.numAllowedVendors.toString() : 'not found'}</Tag>
        </div>
        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabel">allowed purposes</span>
          <Tag>{this.state.allowedPurposes ? this.state.allowedPurposes.toString() : 'not found'}</Tag>
        </div>

        <div class="MoliDebug-tagContainer">
          <span class="MoliDebug-tagLabelBtn" type="button" data-toggle="collapse" data-target="#collapseConsentString"
                  aria-expanded="false" aria-controls="collapseConsentString">
            consent string
          </span>
          <Tag>
            <a class="link" href={`https://useless.af/consent-decoder?gdpr_consent=${this.state.consentData ? this.state.consentData.consentData : ''}`}>
            useless.af
            </a>
          </Tag>
          <div class="collapse" id="collapseConsentString">
            <Tag>{this.state.consentData ? this.state.consentData.consentData : 'not found'}</Tag>
          </div>
        </div>
      </div>;
    }
  };

  private isCmpFunctionAvailable = () => window.__cmp || typeof window.__cmp === 'function';

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
}
