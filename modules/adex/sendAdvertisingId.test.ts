import { sendAdvertisingID } from './sendAdvertisingId';
import * as Sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);

describe('sendAdvertisingId', () => {
  const sandbox = Sinon.createSandbox();

  const adexCustomerId = '123';
  const adexTagId = '456';
  const advertisingId = '1234-5678-9123';

  it('should send a request to the in-app endpoint', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchSpy
    );

    expect(fetchSpy).to.have.been.called;
  });
  it('should use the adexCustomerId, adexTagId and advertisingId as request params', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchSpy
    );

    expect(fetchSpy).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv=[{"iab_cat":"Medical"}]`
    );
  });
  it('should use "aaid" as ifa param if clientType is "android"', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchSpy
    );

    expect(fetchSpy).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv=[{"iab_cat":"Medical"}]`
    );
  });
  it('should use "idfa" as ifa param if clientType is "ios"', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'ios',
      fetchSpy
    );

    expect(fetchSpy).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=idfa&kv=[{"iab_cat":"Medical"}]`
    );
  });
  it('should append the consentString to the request url if it is given as argument', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(
      adexCustomerId,
      adexTagId,
      advertisingId,
      [{ iab_cat: 'Medical' }],
      'android',
      fetchSpy,
      'testString'
    );

    expect(fetchSpy).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid&kv=[{"iab_cat":"Medical"}]&gdpr_consent=testString`
    );
  });
  it('should not append the Adex key-values to the request url if there is no key-value pair in the list', () => {
    const fetchSpy = sandbox.spy();
    sendAdvertisingID(adexCustomerId, adexTagId, advertisingId, [], 'android', fetchSpy);

    expect(fetchSpy).to.have.been.calledOnceWithExactly(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=aaid`
    );
  });
});
