import React from 'react';

import { Tag } from './tag';

import { TCModel, TCString } from '@iabtcf/core';
import { tcfapi } from '../../types/tcfapi';
import { IdBoolTuple } from '@iabtcf/core/lib/mjs/model/Vector';

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
  text: string | React.ReactElement;
};

export const ConsentConfig: React.FC = () => {
  const [consentState, setConsentState] = React.useState<IConsentConfigState>({ messages: [] });

  // componentDidMount - initialize consent data
  React.useEffect(() => {
    // update consent status
    if (window.__tcfapi) {
      // Update on changes
      window.__tcfapi('addEventListener', 2, event => {
        const tcModel = event.gdprApplies ? TCString.decode(event.tcString) : undefined;
        setConsentState(prevState => ({
          ...prevState,
          cmpStatus: event.cmpStatus,
          tcModel: tcModel,
          tcString: event.gdprApplies ? event.tcString : 'none'
        }));
      });
    } else {
      setConsentState(prevState => ({
        ...prevState,
        cmpStatus: tcfapi.status.CmpStatus.ERROR
      }));
    }

    // if cmp is configured, there must be a cmp present
    if (!isCmpFunctionAvailable()) {
      const errorMessage: Message = {
        kind: 'error',
        text: 'no window.__tcfapi function found. Consent management and ads will not work!'
      };
      setConsentState(prevState => ({
        ...prevState,
        messages: [errorMessage, ...prevState.messages]
      }));
    }
  });

  const cmpVendorTag = (): React.ReactElement => {
    if (consentState.tcModel) {
      const cmpVendor = cmpVendors[consentState.tcModel.cmpId.toString()];
      if (cmpVendor) {
        return (
          <Tag variant="grey">
            <a className="d-link" href={cmpVendor.website}>
              {cmpVendor.name} (id: {consentState.tcModel.cmpId.toString()})
            </a>
          </Tag>
        );
      } else {
        return <Tag variant="yellow">{consentState.tcModel.cmpId.toString()}</Tag>;
      }
    } else {
      return <Tag variant="red">No defined</Tag>;
    }
  };

  const consent = (): React.ReactElement => {
    const { gdprApplies, tcModel } = consentState;
    return (
      <div>
        <div className="mt-2 flex flex-wrap items-center gap-y-1">
          <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
            <a href="https://iabeurope.eu/cmp-list/">GDPR</a>
          </span>
          {!!gdprApplies}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-y-1">
          <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
            <a href="https://iabeurope.eu/cmp-list/">CMP ID</a>
          </span>
          {cmpVendorTag()}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-y-1">
          <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">Last updated</span>
          {tcModel ? (
            <Tag>{tcModel.lastUpdated.toLocaleString()}</Tag>
          ) : (
            <Tag variant="red">Unknown</Tag>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-y-1">
          <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
            TCF Policy Version
          </span>
          {tcModel ? (
            <Tag>{tcModel.policyVersion.toString()}</Tag>
          ) : (
            <Tag variant="red">Unknown</Tag>
          )}
        </div>
      </div>
    );
  };
  const isCmpFunctionAvailable = () => window.__tcfapi || typeof window.__tcfapi === 'function';

  const consentData = (): React.ReactElement | undefined => {
    if (isCmpFunctionAvailable()) {
      return (
        <div>
          <div className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
              vendor list version
            </span>
            <Tag>
              {consentState.tcModel
                ? consentState.tcModel.vendorListVersion.toString()
                : 'not found'}
            </Tag>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="inline-block min-w-36 max-w-96 pr-1 font-medium">
              num vendors allowed
            </span>
            <Tag>
              {consentState.tcModel
                ? consentState.tcModel.vendorConsents.size.toString()
                : 'not found'}
            </Tag>
          </div>
          <div className="d-collapse d-collapse-arrow mt-2 rounded-md bg-base-200">
            <input type="checkbox" aria-label="toggle allowed purposes" />
            <div className="d-collapse-title min-h-0 py-2 text-sm font-medium">
              allowed purposes
              <Tag>
                {consentState.tcModel
                  ? consentState.tcModel.purposeConsents.size.toString()
                  : 'not found'}
              </Tag>
            </div>
            <div className="d-collapse-content text-sm">
              <a
                className="d-link"
                href="https://iabeurope.eu/iab-europe-transparency-consent-framework-policies/#Appendix_A_Purposes_and_Features_Definitions"
              >
                Purpose and Feature definitions
              </a>
              <br />
              {consentState.tcModel &&
                Array.from<IdBoolTuple>(consentState.tcModel.purposeConsents).map(
                  ([id, accepted]) => {
                    return (
                      <Tag key={id} variant={accepted ? 'green' : 'red'}>
                        {id.toString()}: {accepted ? 'accepted' : 'denied'}
                      </Tag>
                    );
                  }
                )}
            </div>
          </div>

          <div className="d-collapse d-collapse-arrow mt-2 rounded-md bg-base-200">
            <input type="checkbox" aria-label="toggle consent string" />
            <div className="d-collapse-title min-h-0 py-2 text-sm font-medium">consent string</div>
            <div className="d-collapse-content text-sm">
              <Tag>{consentState.tcString ? consentState.tcString : 'not found'}</Tag>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div>
      {consent()}
      {consentData()}
    </div>
  );
};
