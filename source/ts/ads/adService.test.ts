import test from 'ava';
import Sinon = require('sinon');
import browserEnv = require('browser-env');

import { AdService } from './adService';
import { IAdNetworkConfiguration, IAdNetworkService } from './IAdNetworkService';
import { performanceMeasurementService } from '../../performanceService';
import { TestLogger } from '../../../utils/logger.test.helper';
import { AdInventoryProvider } from './adInventoryProvider';
import { DfpQDPPositionSlot, DfpSlot, StickySlot } from './adNetworkSlot';
import { IAppConfig, IVertical } from '../../../config/appConfig';
import { gfContext } from '../../../context/GfContext';

const sandbox = Sinon.createSandbox();

const testfrage: IVertical = {
  platform: 'tf',
  name: 'testfrage',
  domain: 'testfrage.net',
  fullDomain: 'www.testfrage.net',
  facebookId: '0'
};

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

test.before(() => {
  browserEnv(['document', 'window']);
  Sinon.stub(gfContext, 'isFeatureSwitchEnabled').callsFake(() => true);
});

test.afterEach(() => {
  sandbox.restore();
});

function createAdNetworkService(networkName: string): IAdNetworkService {
  return {
    networkName: networkName,
    initialize: (_: DfpSlot[], __: IAdNetworkConfiguration) => Promise.resolve()
  };
}

/**
 * @param appConfig
 * @param adSlots - the adSlot the provider provides
 * @returns {AdInventoryProvider}
 */
function createAdSlotInventoryProvider(appConfig: IAppConfig, adSlots: DfpSlot[]): AdInventoryProvider {
  const adInventoryProvider = new AdInventoryProvider(appConfig.adConfiguration!, new TestLogger());

  Sinon.stub(adInventoryProvider, 'adSlotInventory').get(() => adSlots);
  return adInventoryProvider;
}

test('AdService - Initialize DFP slots', () => {
  const appConfig = {
    adConfiguration
  } as IAppConfig;

  const adNetworkService = createAdNetworkService('dfp');

  // AdSlots
  const adSlots: DfpSlot[] = [
    new DfpQDPPositionSlot('id-pos1', 'pos1', []),
    new StickySlot('id-sticky', []),
  ];

  const adService = new AdService(
    [adNetworkService],
    createAdSlotInventoryProvider(appConfig, adSlots),
    performanceMeasurementService,
    testfrage,
    new TestLogger()
  );

  const adNetworkServiceStub = sandbox.spy(adNetworkService, 'initialize');
  return adService.initialize().then(() => {
    Sinon.assert.calledOnce(adNetworkServiceStub);
    Sinon.assert.calledWith(adNetworkServiceStub, adSlots, appConfig.adConfiguration);
  });
});


