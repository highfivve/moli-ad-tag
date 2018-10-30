import test, { Context, GenericTestContext } from 'ava';
import { gfUserAgent } from '../../../context/UserAgent';

import { AdInventoryProvider } from './adInventoryProvider';
import { TestLogger } from '../../../utils/logger.test.helper';
import { DfpPrebidSlot, DfpQDPPositionSlot, DfpSlotLazy } from './adNetworkSlot';
import { IAdNetworkConfiguration } from './IAdNetworkService';
import Sinon = require('sinon');

interface ITestContext {
  sandbox: Sinon.SinonSandbox;
  adInventory: AdInventoryProvider;
  stubQdpClientWidth: ((_: number) => void);
}

test.beforeEach((t: GenericTestContext<Context<ITestContext>>) => {
  t.context.sandbox = Sinon.createSandbox();

  const adConfiguration: IAdNetworkConfiguration = {
    tags: ['Test1', 'Test2'],
    consultation: false,
    isAdultContent: false,
    marketingChannel: {
      channel: 'MainTest',
      subChannel: 'SubTest',
      channelGfThemaId: 'gf_thema_MainTest'
    },
    abTest: 1
  };

  t.context.adInventory = new AdInventoryProvider(adConfiguration, new TestLogger());
  t.context.stubQdpClientWidth = (width: number) => {
    t.context.sandbox.stub(document, 'querySelector').returns({
      getBoundingClientRect(): any {
        return {width: width};
      }
    });
  };
});

(test.afterEach).always((t: GenericTestContext<Context<ITestContext>>) => {
  t.context.sandbox.restore();
});

test('AdInventoryProvider - provides listing page ad slots on mobile', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  sandbox.stub(gfUserAgent, 'isMobile').callsFake(() => true);

  const adSlotIds = adInventory.adSlotInventory.map(slot => slot.id);

  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-2'), 'ad-listingpages-2 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-3'), 'ad-listingpages-3 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-4'), 'ad-listingpages-4 not present');
});

test('AdInventoryProvider - provides listing page ad slots on desktop', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  sandbox.stub(gfUserAgent, 'isMobile').callsFake(() => false);

  const adSlotIds = adInventory.adSlotInventory.map(slot => slot.id);

  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-2'), 'ad-listingpages-2 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-3'), 'ad-listingpages-3 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-listingpages-4'), 'ad-listingpages-4 not present');
});

test('AdInventoryProvider - DFP slots are enabled on desktop (QDP 10x10)', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  sandbox.stub(gfUserAgent, 'isMobile').callsFake(() => false);
  // enable big performance banner
  sandbox.stub(window, 'matchMedia').returns({matches: true});
  sandbox.stub(adInventory, 'isQdp').callsFake(() => true);
  // FIXME stub [data-ref="Question"] explicitly
  t.context.stubQdpClientWidth(1024);

  const adSlotIds = adInventory.adSlotInventory.map(slot => slot.id);

  t.truthy(adSlotIds.find(id => id === 'ad-presenter-desktop'), 'ad-presenter-desktop not present');
  t.truthy(adSlotIds.find(id => id === 'ad-sidebar-1'), 'ad-sidebar-1 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-sidebar-2'), 'ad-sidebar-2 not present');
  t.truthy(adSlotIds.find(id => id === 'ad-sidebar-skyScraper'), 'ad-sidebar-skyScraper not present');
});

test('AdInventoryProvider - ad-sidebar-3 is enabled on desktop when abTest > 50 (QDP 10x10)', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  const adConfiguration: IAdNetworkConfiguration = {
    ...adInventory.adConfiguration,
    abTest: 51
  };
  sandbox.stub(gfUserAgent, 'isMobile').callsFake(() => false);
  // enable big performance banner
  sandbox.stub(window, 'matchMedia').returns({matches: true});
  sandbox.stub(adInventory, 'isQdp').callsFake(() => true);
  sandbox.stub(adInventory, 'adConfiguration').get(() => adConfiguration);
  t.context.stubQdpClientWidth(605);

  const adSlotIds = adInventory.adSlotInventory.map(slot => slot.id);

  t.truthy(adSlotIds.find(id => id === 'ad-sidebar-3'), 'ad-sidebar-3 not present');
});

test.skip('AdInventoryProvider - use prebid slots on desktop', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  sandbox.stub(gfUserAgent, 'isMobile').callsFake(() => false);

  // stub qdp size calculation
  t.context.stubQdpClientWidth(605);

  const adSlots = adInventory.adSlotInventory;

  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-1' && slot instanceof DfpQDPPositionSlot), 'ad-answerstream-1 not present or DfpQDPPositionSlot');
  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-2' && slot instanceof DfpQDPPositionSlot), 'ad-answerstream-2 not present or DfpQDPPositionSlot');
  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-3' && slot instanceof DfpSlotLazy), 'ad-answerstream-3 not present or DfpSlotLazy');
  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-4' && slot instanceof DfpQDPPositionSlot), 'ad-answerstream-4 not present or DfpQDPPositionSlot');
  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-5' && slot instanceof DfpQDPPositionSlot), 'ad-answerstream-5 not present or DfpQDPPositionSlot');
});

test('AdInventoryProvider - provides answerstream adslots on mobile (10x10)', (t: GenericTestContext<Context<ITestContext>>) => {
  const sandbox = t.context.sandbox;
  const adInventory = t.context.adInventory;
  sandbox.stub(gfUserAgent, 'isMobile').returns(true);

  // stub qdp size calculation
  t.context.stubQdpClientWidth(320);

  const adSlots = adInventory.adSlotInventory;

  t.truthy(adSlots.find(slot => slot.id === 'ad-answerstream-1' && slot instanceof DfpPrebidSlot), 'ad-answerstream-1 not present or DfpPrebidQDPPositionSlot');
});

test('AdInventoryProvider - adSlotForPassback maps Spotx passback', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;

  // stub qdp size calculation
  t.context.stubQdpClientWidth(605);

  const pos2Slot = adInventory.adSlotForPassback('/33559401/gf/fragen/Passback_Spotx');
  t.truthy(pos2Slot);
  t.truthy(pos2Slot!.adUnitPath === '/33559401/gf/fragen/pos2');
});

test('AdInventoryProvider - adSlotForPassback maps Smartclip passback', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;

  // stub qdp size calculation
  t.context.stubQdpClientWidth(605);

  const pos2Slot = adInventory.adSlotForPassback('/33559401/gf/fragen/Passback_Smartclip');
  t.truthy(pos2Slot);
  t.truthy(pos2Slot!.adUnitPath === '/33559401/gf/fragen/pos2');
});


test('AdInventoryProvider - desktop slots are unique (10x10)', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;

  t.context.sandbox.stub(gfUserAgent, 'isMobile').returns(false);
  // stub qdp size calculation
  t.context.stubQdpClientWidth(1024);

  const adSlots = adInventory.adSlotInventory;
  adSlots.forEach(slot1 => {
    const identicalIds = adSlots.filter(slot2 => slot1.id === slot2.id);
    t.true(identicalIds.length === 1, `Found duplicates DOM ids: ${identicalIds.join(' ')}`);
  });
});

test('AdInventoryProvider - desktop slots are unique', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;
  t.context.sandbox.stub(gfUserAgent, 'isMobile').returns(false);
  // stub qdp size calculation
  t.context.stubQdpClientWidth(1024);

  const adSlots = adInventory.adSlotInventory;
  adSlots.forEach(slot1 => {
    const identicalIds = adSlots.filter(slot2 => slot1.id === slot2.id);
    t.true(identicalIds.length === 1, `Found duplicates DOM ids: ${identicalIds.join(' ')}`);
  });
});

test('AdInventoryProvider - mobile slots are unique (10x10)', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;
  t.context.sandbox.stub(gfUserAgent, 'isMobile').returns(true);

  const adSlots = adInventory.adSlotInventory;
  adSlots.forEach(slot1 => {
    const identicalIds = adSlots.filter(slot2 => slot1.id === slot2.id);
    t.true(identicalIds.length === 1, `Found duplicates DOM ids: ${identicalIds.join(' ')}`);
  });
});

test('AdInventoryProvider - mobile slots are unique', (t: GenericTestContext<Context<ITestContext>>) => {
  const adInventory = t.context.adInventory;
  t.context.sandbox.stub(gfUserAgent, 'isMobile').returns(true);
  const adSlots = adInventory.adSlotInventory;

  adSlots.forEach(slot1 => {
    const identicalIds = adSlots.filter(slot2 => slot1.id === slot2.id);
    t.true(identicalIds.length === 1, `Found duplicates DOM ids: ${identicalIds.join(' ')}`);
  });
});
