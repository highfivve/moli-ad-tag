import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import type { googletag } from 'ad-tag/types/googletag';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createEventContextStub } from 'ad-tag/stubs/analytics';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';
import { mapGPTSlotRenderEnded } from 'ad-tag/ads/modules/moli-analytics/events/gptSlotRenderEnded';

use(sinonChai);

describe('AnalyticsGPTSlotRenderEnded', () => {
  const sandbox = sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const adContext = adPipelineContext(jsDomWindow);
  const now = 1000000;
  const userId = 'user-id';
  const adUnitCode = 'ad_header';
  const adUnitPath = '/111,222/example/example_header/desktop/example.com';
  let eventContext: ReturnType<typeof createEventContextStub> & {
    auctionId: string;
    adUnitName: string;
    gpid: string;
  };

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
    jsDomWindow.pbjs = createPbjsStub();
    eventContext = {
      ...createEventContextStub(),
      auctionId: 'auc-001',
      adUnitName: 'header',
      gpid: adUnitPath
    };
    adContext.window__.pbjs = {
      ...adContext.window__.pbjs,
      getUserIds: sandbox.stub().returns({ pubcid: userId })
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapGPTSlotRenderEnded', () => {
    const size = '300x200';
    const event = {
      slot: {
        getAdUnitPath: sandbox.stub().returns(adUnitPath),
        getSlotElementId: sandbox.stub().returns(adUnitCode)
      } as any,
      isEmpty: false,
      size: size.split('x').map(Number)
    } as googletag.events.ISlotRenderEndedEvent;

    const result = mapGPTSlotRenderEnded(event, eventContext, adContext);

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'gpt.slotRenderEnded');
    expect(result).to.have.property('publisher', eventContext.publisher);
    expect(result).to.have.property('pageViewId', eventContext.pageViewId);
    expect(result).to.have.property('userId', userId);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.property('analyticsLabels', eventContext.analyticsLabels);
    expect(result).to.have.property('data').that.is.an('object');

    const data = result.data;
    expect(data).to.have.property('auctionId', eventContext.auctionId);
    expect(data).to.have.property('gpid', eventContext.gpid);
    expect(data).to.have.property('adUnitPath', event.slot.getAdUnitPath());
    expect(data).to.have.property('adUnitCode', adUnitCode);
    expect(data).to.have.property('adUnitName', eventContext.adUnitName);
    expect(data).to.have.property('size', size);
    expect(data).to.have.property('isEmpty', event.isEmpty);
  });

  it('testMapGPTSlotRenderEnded with size as number array', () => {
    const event = {
      slot: {
        getAdUnitPath: sandbox.stub().returns(adUnitPath),
        getSlotElementId: sandbox.stub().returns(adUnitCode)
      } as any,
      isEmpty: false,
      size: [300, 200]
    } as googletag.events.ISlotRenderEndedEvent;

    const result = mapGPTSlotRenderEnded(event, eventContext, adContext);

    expect(result.data).to.have.property('size', '300x200');
  });

  it('testMapGPTSlotRenderEnded with size as null', () => {
    const event = {
      slot: {
        getAdUnitPath: sandbox.stub().returns(adUnitPath),
        getSlotElementId: sandbox.stub().returns(adUnitCode)
      } as any,
      isEmpty: false,
      size: null
    } as googletag.events.ISlotRenderEndedEvent;

    const result = mapGPTSlotRenderEnded(event, eventContext, adContext);

    expect(result.data).to.have.property('size', '');
  });
});
