import { sendAdvertisingID } from './sendAdvertisingId';
import * as Sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { googletag, prebidjs } from '@highfivve/ad-tag';
import { ITheAdexWindow } from './index';

use(sinonChai);

describe('sendAdvertisingId', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow & ITheAdexWindow =
    dom.window as any;

  const adexCustomerId = '123';
  const adexTagId = '456';
  const advertisingId = '1234-5678-9123';

  beforeEach(() => {
    // dummy fetch function in order to be able to stub it
    jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(new Response());
  });

  it('should send a request to the in-app endpoint', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.called;
  });
  it('should use the adexCustomerId, adexTagId and advertisingId as request params', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv={"iab_cat":"Medical"}`
    );
  });
  it('should use "aaid" as ifa param if clientType is "android"', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv={"iab_cat":"Medical"}`
    );
  });
  it('should use "idfa" as ifa param if clientType is "ios"', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'ios',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=idfa&kv={"iab_cat":"Medical"}`
    );
  });
  it('should append the consentString to the request url if it is given as argument', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchStub,
      noopLogger,
      'testString'
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv={"iab_cat":"Medical"}&gdpr_consent=testString`
    );
  });
  it('should not append the Adex key-values to the request url if there is no key-value pair in the list', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [],
      'android',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid`
    );
  });
  it('should send an object as key values to the Adex ', () => {
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('whatever'));
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [
        { iab_cat: 'Medical' },
        { device_type: 'desktop' },
        { page_tag: 'interessant,interessante-themen,umfrage' }
      ],
      'android',
      fetchStub,
      noopLogger
    );

    expect(fetchStub).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv={"iab_cat":"Medical","device_type":"desktop","page_tag":"interessant,interessante-themen,umfrage"}`
    );
  });
});
