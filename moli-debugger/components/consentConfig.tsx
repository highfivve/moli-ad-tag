import React, { Component } from 'react';

import { Tag } from './tag';

import { tcfapi } from '@highfivve/ad-tag/source/ts/types/tcfapi';
import { TCModel, TCString } from '@iabtcf/core';

type CmpVendor = {
  name: string;
  website: string;
  subDomain: string;
};
type CmpVendors = { [id: string]: CmpVendor | undefined };

const cmpVendors: CmpVendors = {
  '3': {
    name: ' LiveRamp',
    website: 'https://liveramp.com/',
    subDomain: '\tfaktor.mgr.consensu.org'
  },
  '5': {
    name: ' Usercentrics GmbH',
    website: 'https://usercentrics.com/',
    subDomain: 'usercentrics.mgr.consensu.org'
  },
  '6': {
    name: 'Sourcepoint Technologies, Inc.',
    website: 'https://sourcepoint.com',
    subDomain: 'sourcepoint.mgr.consensu.org'
  },
  '10': {
    name: 'Quantcast International Limited',
    website: 'https://quantcast.com',
    subDomain: 'quantcast.mgr.consensu.org'
  },
  '21': {
    name: 'Traffective GmbH',
    website: 'https://traffective.com',
    subDomain: 'traffective.mgr.consensu.org'
  }
};

declare const window: Window & tcfapi.TCFApiWindow;

type IConsentConfigState = {
  gdprApplies?: boolean;
  cmpStatus?: tcfapi.status.CmpStatus;
  tcModel?: TCModel;
  tcString?: string;
  messages: Message[];
};

type Message = {
  kind: 'error' | 'warning';
  text: string | JSX.Element;
};

export class ConsentConfig extends Component<{}, IConsentConfigState> {
  constructor(props) {
    super(props);
    this.state = {
      messages: []
    };
    this.checkConsentConfig(this.state.messages);
  }

  componentDidMount() {
    this.initConsentData();
  }

  render(): JSX.Element {
    return (
      <div>
        {this.consent()}
        {this.consentData()}
      </div>
    );
  }

  private consent = (): JSX.Element => {
    const { gdprApplies, tcModel } = this.state;
    return (
      <div>
        <div className="MoliDebug-tagContainer">
          <span className="MoliDebug-tagLabel">
            <a href="https://iabeurope.eu/cmp-list/">GDPR</a>
          </span>
          {!!gdprApplies}
        </div>
        <div className="MoliDebug-tagContainer">
          <span className="MoliDebug-tagLabel">
            <a href="https://iabeurope.eu/cmp-list/">CMP ID</a>
          </span>
          {this.cmpVendorTag()}
        </div>
        <div className="MoliDebug-tagContainer">
          <span className="MoliDebug-tagLabel">Last updated</span>
          {tcModel ? (
            <Tag>{tcModel.lastUpdated.toLocaleString()}</Tag>
          ) : (
            <Tag variant="red">Unknown</Tag>
          )}
        </div>
        <div className="MoliDebug-tagContainer">
          <span className="MoliDebug-tagLabel">TCF Version</span>
          {tcModel ? <Tag>{tcModel.version.toString()}</Tag> : <Tag variant="red">Unknown</Tag>}
        </div>
      </div>
    );
  };

  private cmpVendorTag = (): JSX.Element => {
    if (this.state.tcModel) {
      const cmpVendor = cmpVendors[this.state.tcModel.cmpId.toString()];
      if (cmpVendor) {
        return (
          <Tag variant="grey">
            <a href={cmpVendor.website}>
              {cmpVendor.name} (id: {this.state.tcModel.cmpId.toString()})
            </a>
          </Tag>
        );
      } else {
        return <Tag variant="yellow">{this.state.tcModel.cmpId.toString()}</Tag>;
      }
    } else {
      return <Tag variant="red">No defined</Tag>;
    }
  };

  private initConsentData = (): void => {
    if (window.__tcfapi) {
      // fetch initial TCData
      window.__tcfapi('getTCData', 2, (data: tcfapi.responses.TCData) => {
        const tcModel = data.gdprApplies ? TCString.decode(data.tcString) : undefined;
        this.setState({
          gdprApplies: data.gdprApplies,
          cmpStatus: data.cmpStatus,
          tcModel: tcModel,
          tcString: data.gdprApplies ? data.tcString : 'none'
        });
      });

      // Update on changes
      window.__tcfapi('addEventListener', 2, event => {
        const tcModel = event.gdprApplies ? TCString.decode(event.tcString) : undefined;
        this.setState({
          cmpStatus: event.cmpStatus,
          tcModel: tcModel,
          tcString: event.gdprApplies ? event.tcString : 'none'
        });
      });
    } else {
      this.setState({
        cmpStatus: tcfapi.status.CmpStatus.ERROR
      });
    }
  };

  private consentData = (): JSX.Element | undefined => {
    if (this.isCmpFunctionAvailable()) {
      return (
        <div>
          <div className="MoliDebug-tagContainer">
            <span className="MoliDebug-tagLabel">vendor list version</span>
            <Tag>
              {this.state.tcModel ? this.state.tcModel.vendorListVersion.toString() : 'not found'}
            </Tag>
          </div>
          <div className="MoliDebug-tagContainer">
            <span className="MoliDebug-tagLabel">num vendors allowed</span>
            <Tag>
              {this.state.tcModel ? this.state.tcModel.vendorConsents.size.toString() : 'not found'}
            </Tag>
          </div>
          <div className="MoliDebug-tagContainer">
            <span
              className="MoliDebug-tagLabelBtn"
              data-toggle="collapse"
              data-target="#collapsePurposes"
              aria-expanded="false"
              aria-controls="collapsePurposes"
            >
              allowed purposes
            </span>
            <Tag>
              {this.state.tcModel
                ? this.state.tcModel.purposeConsents.size.toString()
                : 'not found'}
            </Tag>

            <div className="collapse" id="collapsePurposes">
              <a href="https://iabeurope.eu/iab-europe-transparency-consent-framework-policies/#Appendix_A_Purposes_and_Features_Definitions">
                Purpose and Feature definitions
              </a>
              <br />
              {this.state.tcModel &&
                Array.from(this.state.tcModel.purposeConsents).map(([id, accepted]) => {
                  return (
                    <Tag variant={accepted ? 'green' : 'red'}>
                      {id.toString()}: {accepted ? 'accepted' : 'denied'}
                    </Tag>
                  );
                })}
            </div>
          </div>

          <div className="MoliDebug-tagContainer">
            <span
              className="MoliDebug-tagLabelBtn"
              data-toggle="collapse"
              data-target="#collapseConsentString"
              aria-expanded="false"
              aria-controls="collapseConsentString"
            >
              consent string
            </span>
            <div className="collapse" id="collapseConsentString">
              <Tag>{this.state.tcString ? this.state.tcString : 'not found'}</Tag>
            </div>
          </div>
        </div>
      );
    }
  };

  private isCmpFunctionAvailable = () => window.__tcfapi || typeof window.__tcfapi === 'function';

  private checkConsentConfig = (messages: Message[]): void => {
    // if cmp is configured, there must be a cmp present
    if (!this.isCmpFunctionAvailable()) {
      messages.push({
        kind: 'error',
        text: 'no window.__tcfapi function found. Consent management and ads will not work!'
      });
    }
  };
}
