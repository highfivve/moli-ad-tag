import * as preact from 'preact';

import { Tag } from './tag';

import { Moli } from '@highfivve/ad-tag';
import { ConsentString } from 'consent-string';
import { IABConsentManagement } from '@highfivve/ad-tag/source/ts/types/IABConsentManagement';
import IConsentData = IABConsentManagement.IConsentData;

type IConsentConfigProps = {
  consent: Moli.consent.ConsentConfig
};

type IConsentConfigState = {
  consentData?: IConsentData,
  nonPersonalizedAds?: 0 | 1,
  vendorListVersion?: number,
  numAllowedVendors?: number,
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
      allowedPurposes: [],
      messages: []
    };
    this.checkConsentConfig(this.state.messages, props.consent);
    this.initConsentData(this.state.messages, props.consent);
  }

  render(props: IConsentConfigProps, state: IConsentConfigState): JSX.Element {
    return <div>
      {this.consent(props.consent)}
      {this.consentData()}
    </div>;
  }

  private consent = (consent: Moli.consent.ConsentConfig): JSX.Element => {
    return <div>
      <div className="MoliDebug-tagContainer">
        <span className="MoliDebug-tagLabel">Module</span>
        {consent.cmp ? <Tag>{consent.cmp.name}</Tag> : <Tag variant="red">No defined</Tag>}
      </div>
      <div className="MoliDebug-tagContainer">
        <span className="MoliDebug-tagLabel">Config</span>
        {consent.cmp ? <Tag>{JSON.stringify(consent.cmp.config())}</Tag> : <Tag variant="red">No config</Tag>}
      </div>
    </div>;
  };

  private initConsentData = (messages: Message[], consent?: Moli.consent.ConsentConfig): void => {
    if (consent && consent.cmp) {
      consent.cmp.getConsentData().then(consentData => {
        this.setState({ consentData });
        const consentString = new ConsentString(consentData ? consentData.consentData : undefined);
        this.setState({ vendorListVersion: consentString.getVendorListVersion() });
        this.setState({ numAllowedVendors: consentString.getVendorsAllowed().length });
        this.setState({ allowedPurposes: consentString.getPurposesAllowed() });
      }).catch(error => {
        messages.push({
          kind: 'error',
          text: `Could'nt get ConsentData. ${error}`
        });
      });

      consent.cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
        this.setState({ nonPersonalizedAds });
      }).catch(error => {
        messages.push({
          kind: 'error',
          text: `Could'nt get nonPersonalizedAds setting. ${error}`
        });
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
            <a class="link"
               href={`https://useless.af/consent-decoder?gdpr_consent=${this.state.consentData ? this.state.consentData.consentData : ''}`}>
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
    if (consent && !consent.cmp) {
      messages.push({
        kind: 'error',
        text: 'no cmp module configured!'
      });
    }

    // if cmp is configured, there must be a cmp present
    if (consent && consent.cmp && !this.isCmpFunctionAvailable()) {
      messages.push({
        kind: 'error',
        text: 'no window.__cmp function found. Consent management and ads will not work!'
      });
    }
  };
}
