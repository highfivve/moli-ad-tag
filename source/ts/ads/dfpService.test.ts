import test from 'ava';
import { GenericTestContext } from 'ava';
import Sinon = require('sinon');

import {cookieService, ICookieService} from '../../cookieService';
import {IAdPerformanceService} from './adPerformanceService';
import { DfpService } from './dfpService';
import { TestLogger } from '../../../utils/logger.test.helper';
import { queryService, IQueryService } from '../../dom/queryService';
import {AssetLoadMethod, AssetType, IAssetLoaderService} from '../../dom/assetLoaderService';
import { googletag } from '../../../types/googletag';
import { prebidjs } from '../../../types/prebidjs';
import { bidderSettings } from './prebid/bidderSettings';
import { AdInventoryProvider } from './adInventoryProvider';
import {DfpSlot, DfpQDPPositionSlot, DfpInPageSlot, DfpPrebidSlot, DfpSkyScraperSlot} from './adNetworkSlot';
import { IAdNetworkConfiguration } from './IAdNetworkService';
import { SinonSandbox } from 'sinon';
import { gfContext } from '../../../context/GfContext';
import { IVertical } from '../../../config/appConfig';

import browserEnv = require('browser-env');
import IPrebidJs = prebidjs.IPrebidJs;
import IRequestObj = prebidjs.IRequestObj;
import { gfUserAgent } from '../../../context/UserAgent';
import { ITrackService } from '../../../tracker/index';
import { apstag } from '../../../types/apstag';
import IApsTag = apstag.IApsTag;
import IBidConfig = apstag.IBidConfig;
import { services } from '../../../services/services';
import {IABConsentManagement} from '../../../types/IABConsentManagement';
import {defaultVendorData, ICmpService} from '../../happyUnicorns/cmpService';

interface IDfpTestContext {
  context: {
    sandbox: Sinon.SinonSandbox;
    allSlotsEmpty: boolean;
    adSlots: DfpSlot[];
    adConfiguration: IAdNetworkConfiguration;
    vertical: IVertical;

    /**
     * Instantiating dependency-free components and creating stubs.
     */
    stubs: {
      queryService: IQueryService;
      logger: TestLogger;
      adInventoryProvider: AdInventoryProvider;
      assetLoaderService: IAssetLoaderService;
      adPerformanceService: IAdPerformanceService;
      trackService: ITrackService,
      cookieService: ICookieService,
      cmpService: ICmpService;
      pubads: googletag.IPubAdsService;
      pbjs: IPrebidJs;
      apstag: IApsTag;
      googletag: googletag.IGoogleTag;
      cmp: Sinon.SinonStub;
      gfUserAgent: {
        isMobile: Sinon.SinonStub
      }
      featureSwitchStub: Sinon.SinonStub
    };

    dfpService: DfpService;

    // helper methods

    /** resolves the gpt promise */
    resolveGPT(): void;

    /** resolves the prebid.js promise */
    resolvePrebid(): void;

    /**
     * Creates a div element in the document.body with the id specified in the adSlot.
     * @param slot
     * @returns the creative div element
     */
    addSlot(slot: DfpSlot): HTMLDivElement;
  };
}

declare const window: Window & IABConsentManagement.IGlobalCMPApi;

test.beforeEach((t: GenericTestContext<IDfpTestContext>) => {
  browserEnv(['document']);

  t.context.sandbox = Sinon.createSandbox();
  t.context.allSlotsEmpty = false;
  t.context.adSlots = [];

  const featureSwitchStub = t.context.sandbox.stub(gfContext, 'isFeatureSwitchEnabled');

  t.context.adConfiguration = {
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
  t.context.vertical = {
    platform: 'gf',
    name: 'gutefrage',
    domain: 'gutefrage.net',
    fullDomain: 'www.gutefrage.net',
    facebookId: '128189426899'
  };

  // Helper functions
  t.context.resolveGPT = () =>  t.context.stubs.googletag.cmd[0]();
  t.context.resolvePrebid = () => t.context.stubs.pbjs.que[0]();

  t.context.addSlot = (slot) => {
    const adDiv = document.createElement('div');
    adDiv.setAttribute('id', slot.id);
    document.body.appendChild(adDiv);
    return adDiv;
  };

  const adInventoryProvider = new AdInventoryProvider(t.context.adConfiguration, new TestLogger());

  const assetLoaderService = <IAssetLoaderService> {
    loadAsset: () => { return Promise.resolve(); }
  };

  const pubads = <googletag.IPubAdsService> {
    set: (_key: String, _value: string) => t.context.stubs.pubads,
    enableSingleRequest: () => false,
    enableAsyncRendering: () => false,
    disableInitialLoad: () => { /* empty */ },
    refresh: () => { /* empty */ },
    setTargeting: (_key: String, _value: string | Array<string>) => t.context.stubs.pubads,
    setRequestNonPersonalizedAds: (_nonPersonalizedAds : 0 | 1) => t.context.stubs.pubads,

    addEventListener: (name: string, callback: any): googletag.IPubAdsService => {

      // TODO refactor this logic into something more consumable
      const countEvents: number = t.context.adSlots.length > 0 ? t.context.adSlots.length : 1;
      // consider ad slot rendered immediately:
      // if allSlotsEmpty is set, all of them are returned empty.
      for (let i: number = 0; i < countEvents; i++) {
        const adSlot = {
          getSlotElementId: function(): string {
            return 'slot-' + (i + 1);
          }
        };

        if (name === 'slotRenderEnded') {
          if (t.context.allSlotsEmpty) {
            callback({
              isEmpty: true,
              slot: adSlot
            });
          } else {
            callback({
              slot: adSlot
            });
          }
        }
      }
      return t.context.stubs.pubads;
    }
  };

  const pbjs: IPrebidJs = {
    que: [],
    adserverRequestSent: false,
    bidderSettings: bidderSettings,
    addAdUnits: () => { /* empty */ },
    setTargetingForGPTAsync: () => { /* empty */ },
    requestBids: (requestParam) => {
      if (requestParam && requestParam.bidsBackHandler) {
        requestParam.bidsBackHandler({}, false);
      }
    },
    getAdserverTargeting: () => { return {}; },
    setConfig: (_: prebidjs.IPrebidJsConfig ) => { /*  empty */}
  };

  const apstag: IApsTag = {
    _Q: [],
    init: function(): void { this._Q.push(['i', arguments]); },
    // resolve the callback directly
    fetchBids: (_bidConfig: IBidConfig, callback: Function): void => {
      callback([]);
    },
    setDisplayBids: () => { /* empty */ },
    targetingKeys: () => { /* empty */ }
  };

  const googletag = <googletag.IGoogleTag> {
    cmd: [],
    pubads: () => t.context.stubs.pubads,
    defineSlot: (_adUnitPath: string, _size: number[][], _slotId: string) => <googletag.IAdSlot> {
      slotId: _slotId,
      setCollapseEmptyDiv(_doCollapse: boolean): void { return; },
      addService(_service: any): void { return; },
      getSlotElementId(): string { return _slotId; },
      getAdUnitPath(): string { return _adUnitPath; },
      setTargeting: (_key: string, _value: string) => { return  {} as any; },
      getTargeting: (_key: string) => { return []; },
    },
    destroySlots: (_opt_slots: googletag.IAdSlot[]) => {return; },
    defineOutOfPageSlot: (_adUnitPath: string, _slotId: string) => <googletag.IAdSlot> {
      setCollapseEmptyDiv(_doCollapse: boolean): void { return; },
      addService(_service: any): void { return; }
    },
    enableServices: () => t.context.stubs.pubads,
    display: (_id: String) => t.context.stubs.pubads
  };

  window.__cmp = () => {return; };
  const cmpService: ICmpService = {
    getConsentData: () => {
      return Promise.resolve(defaultVendorData);
    },
    autoOptIn: () => {
      return Promise.resolve();
    }
  };

  const adPerformanceService: IAdPerformanceService = {
    setAdBlockerDetected: () => { return; },
    markDfpInitialization: () => { return; },
    markRegisterSlot: (_: DfpSlot) => { return; },
    markPrebidSlotsRequested: () => { return; },
    measurePrebidSlots: (_prebidSlots: DfpPrebidSlot[], _bids: prebidjs.IBidResponsesMap) => { return; },
    measureFirstAdLoadTime: (_googleTag: googletag.IGoogleTag, _adSlots: DfpSlot[]) => { return Promise.resolve(); },
    measureAdSlots: (_googleTag: googletag.IGoogleTag, _adSlots: DfpSlot[]) => { return; },
    markCmpInitialization: () => { return ; },
    measureCmpLoadTime: () => { return; }
  };

  t.context.stubs = {
    queryService,
    logger: new TestLogger(),
    adInventoryProvider,
    assetLoaderService,
    adPerformanceService,
    trackService: services.base.trackService,
    cookieService: cookieService,
    cmpService: cmpService,
    pubads,
    pbjs,
    apstag,
    googletag,
    cmp: t.context.sandbox.stub(window, '__cmp'),
    gfUserAgent: {
      isMobile: t.context.sandbox.stub(gfUserAgent, 'isMobile').returns(true)
    },
    featureSwitchStub
  };

  t.context.dfpService = new DfpService(
    t.context.stubs.googletag,
    t.context.stubs.pbjs,
    t.context.stubs.queryService,
    t.context.stubs.adPerformanceService,
    t.context.stubs.trackService,
    t.context.stubs.assetLoaderService,
    t.context.stubs.cookieService,
    t.context.stubs.cmpService,
    t.context.stubs.logger,
    t.context.stubs.apstag
  );

});

(<any>test.afterEach).always((t: GenericTestContext<IDfpTestContext>) => {
  t.context.sandbox.restore();
});


test.serial('DFPService registers callback with googletag', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(2);
  t.is(t.context.stubs.googletag.cmd.length, 0);
  t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.is(t.context.stubs.googletag.cmd.length, 1);
});

test.serial('DFPService setup works correctly', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(9);
  const sandbox: SinonSandbox = t.context.sandbox;
  const tagEnableServicesSpy = sandbox.stub(t.context.stubs.googletag, 'enableServices');
  const tagDefineSlotSpy = sandbox.stub(t.context.stubs.googletag, 'defineSlot');
  const tagDisplaySpy = sandbox.stub(t.context.stubs.googletag, 'display').callThrough();

  const pubadsSetSpy = sandbox.stub(t.context.stubs.pubads, 'set');
  const pubadsAsyncRenderingSpy = sandbox.stub(t.context.stubs.pubads, 'enableAsyncRendering');
  const pubadsDisableInitialLoadSpy = sandbox.stub(t.context.stubs.pubads, 'disableInitialLoad');
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();
  const pubadsSetRequestNonPersonalizedAdsSpy = sandbox.stub(t.context.stubs.pubads, 'setRequestNonPersonalizedAds').callThrough();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);

  // invoke callback; this calls resolve() on Promise generated by initAndShowDfp()
  t.context.resolveGPT();
  t.context.resolvePrebid();

  const marketingChannel = t.context.adConfiguration.marketingChannel.channel;
  const marketingSubChannel = t.context.adConfiguration.marketingChannel.subChannel;
  const channelGfThemaId = (<IAdNetworkConfiguration>t.context.stubs.adInventoryProvider.adConfiguration).marketingChannel.channelGfThemaId;

  return promise.then(() => {
    t.truthy(tagEnableServicesSpy.called, 'Single request mode was not enabled');
    t.truthy(pubadsSetTargetingSpy.calledWith('channel', marketingChannel), 'Incorrect marketing channel was set');
    t.truthy(pubadsSetTargetingSpy.calledWith('subChannel', marketingSubChannel), 'Incorrect marketing subChannel was set');
    t.truthy(pubadsSetSpy.calledWith('adsense_channel_ids', channelGfThemaId), 'Incorrect adsense channel(s) were set');
    t.truthy(pubadsAsyncRenderingSpy.called, 'EnableSingleRequest not called');
    t.truthy(pubadsDisableInitialLoadSpy.calledOnce, 'disableInitialLoad not called');
    t.truthy(pubadsSetRequestNonPersonalizedAdsSpy.notCalled, 'setRequestNonPersonalizedAds should not be called by default');
    t.truthy(tagDefineSlotSpy.notCalled, 'no AdSlot instances provided, but defineSlot was called regardless');
    t.truthy(tagDisplaySpy.notCalled, 'No AdSlot instances provided, yet display() was called');
  });
});

test.serial('DFPService setup without a marketing channel or subchannel', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const adConfiguration: IAdNetworkConfiguration = {
    ...t.context.adConfiguration,
    marketingChannel: {
      channel: '',
      channelGfThemaId: ''
    }
  };

  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], adConfiguration, t.context.vertical);

  // invoke callback; this calls resolve() on Promise generated by initAndShowDfp()
  t.context.resolveGPT();
  t.context.resolvePrebid();

  const marketingChannel = 'sonstige';

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith('channel', marketingChannel), 'Incorrect marketing channel was set');
  });
});

test.serial('DFPService setup with renamed marketing channel name', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const adConfiguration: IAdNetworkConfiguration = {
    ...t.context.adConfiguration,
    marketingChannel: {
      channel: 'PersonalFinance',
      subChannel: 'FinanceLaw',
      channelGfThemaId: ''
    }
  };

  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledWith(pubadsSetTargetingSpy, 'channel', 'PersonalFinance');
    Sinon.assert.calledWith(pubadsSetTargetingSpy, 'subChannel', 'FinanceLaw');
    t.pass();
  });
});

test.serial('DFPService setup with a non-vertical sets correct marketing channel', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const reisefrage: IVertical = {
    platform: 'rf',
    name: 'reisefrage',
    domain: 'reisefrage.net',
    fullDomain: 'www.reisefrage.net',
    facebookId: '0'
  };

  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, reisefrage);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledWith(pubadsSetTargetingSpy, 'channel', 'Travel');
    Sinon.assert.neverCalledWith(pubadsSetTargetingSpy, 'subChannel');
    t.pass();
  });
});

test.serial('DFPService registers, displays and refreshes regular adSlots', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(6);
  const sandbox: SinonSandbox = t.context.sandbox;
  const displaySpy = sandbox.stub(t.context.stubs.googletag, 'display');
  const pubAdsRefreshSpy = sandbox.stub(t.context.stubs.googletag.pubads(), 'refresh');
  const tagDefineSlotStub = sandbox.stub(t.context.stubs.googletag, 'defineSlot').callThrough();

  // load prebid js and execute callback
  sandbox.stub(t.context.stubs.assetLoaderService, 'loadAsset').resolves();
  sandbox.stub(t.context.stubs.pbjs, 'requestBids').callsFake((requestParam: IRequestObj) => {
    requestParam.bidsBackHandler!({}, false);
  });
  sandbox.stub(t.context.stubs.apstag, 'fetchBids').callsFake((_bidConfig: IBidConfig, callback: (bids: Object[]) => void) => {
    callback([]);
  });

  // try with three slots; two are rendered, the third isn't (because we don't have enough answers or whatever)
  // no lazy loaded slots
  const adSlots : DfpQDPPositionSlot[] = [
    new DfpQDPPositionSlot('test1', 'pos1', [[2, 2], [1, 1]]),
    new DfpQDPPositionSlot('test2', 'pos2', [[2, 2], [1, 1]]),
    new DfpQDPPositionSlot('not_rendered_slot', 'pos3', [[2, 2], [1, 1]])
  ];

  // Add two ad slot divs to the DOM (but not the third one)
  t.context.addSlot(adSlots[0]);
  t.context.addSlot(adSlots[1]);

  const promise = t.context.dfpService.initialize(adSlots, t.context.adConfiguration, t.context.vertical);

  // call resolve() on promise generated by initAndShowDfp()
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledOnce(pubAdsRefreshSpy);
    Sinon.assert.calledWith(pubAdsRefreshSpy,
      Sinon.match(adSlots
        .filter(slot => slot.id !== 'not_rendered_slot')
        .map(slot => Sinon.match.has('slotId', slot.id))
      )
    );

    adSlots.forEach((slot) => {
      if (slot.id === 'test1' || slot.id === 'test2') {
        // Sinon.assert.calledWith(tagDefineSlotStub, slot.adUnitPath, slot.size, slot.id);
        t.truthy(tagDefineSlotStub.withArgs(slot.adUnitPath, slot.size, slot.id).calledOnce);
        t.truthy(displaySpy.withArgs(slot.id).calledOnce);
      } else {
        t.truthy(tagDefineSlotStub.withArgs(slot.adUnitPath, slot.size, slot.id).notCalled);
        t.truthy(displaySpy.withArgs(slot.id).notCalled);
      }
    });
  });
});

test.serial('DFPService registers, displays and refreshes prebid adSlots', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(2);
  const sandbox: SinonSandbox = t.context.sandbox;
  const displaySpy = sandbox.stub(t.context.stubs.googletag, 'display');
  const pubAdsRefreshSpy = sandbox.stub(t.context.stubs.googletag.pubads(), 'refresh');
  const tagDefineSlotStub = sandbox.stub(t.context.stubs.googletag, 'defineSlot').callThrough();

  // load prebid js and execute callback
  sandbox.stub(t.context.stubs.assetLoaderService, 'loadAsset').resolves();
  sandbox.stub(t.context.stubs.pbjs, 'requestBids').callsFake((requestParam: IRequestObj) => {
    requestParam.bidsBackHandler!({}, false);
  });
  sandbox.stub(t.context.stubs.apstag, 'fetchBids').callsFake((_bidConfig: IBidConfig, callback: (bids: Object[]) => void) => {
    callback([]);
  });

  // try with three slots; two are rendered, the third isn't (because we don't have enough answers or whatever)
  // no lazy loaded slots
  const prebidSlot = new DfpPrebidSlot(new DfpQDPPositionSlot(
    'test1', 'pos1', [[1, 1]]
  ), [],
    {
      banner: {
        sizes: []
      }
    });
  t.context.addSlot(prebidSlot);

  const promise = t.context.dfpService.initialize([prebidSlot], t.context.adConfiguration, t.context.vertical);

  // call resolve() on promise generated by initAndShowDfp()
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledOnce(pubAdsRefreshSpy);
    Sinon.assert.calledWith(pubAdsRefreshSpy,  Sinon.match([Sinon.match.has('slotId', prebidSlot.id)]));

    t.truthy(tagDefineSlotStub.withArgs(prebidSlot.adUnitPath, prebidSlot.size, prebidSlot.id).calledOnce);
    t.truthy(displaySpy.withArgs(prebidSlot.id).calledOnce);
  });
});

test.serial('DFPService registers, displays and refreshes adSlots when prebid fails', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(6);
  const sandbox: SinonSandbox = t.context.sandbox;
  const displaySpy = sandbox.stub(t.context.stubs.googletag, 'display');
  const pubAdsRefreshSpy = sandbox.stub(t.context.stubs.googletag.pubads(), 'refresh');
  const tagDefineSlotStub = sandbox.stub(t.context.stubs.googletag, 'defineSlot').callThrough();

  // prebid.js could not be loaded, e.g. bad network connection
  const loadAssetStub = sandbox.stub(t.context.stubs.assetLoaderService, 'loadAsset');
  loadAssetStub.withArgs( {
    name: 'A9',
    assetType: AssetType.SCRIPT,
    loadMethod: AssetLoadMethod.TAG,
    assetUrl: `//c.amazon-adsystem.com/aax2/apstag.js`
  }).resolves();

  sandbox.stub(t.context.stubs.pbjs, 'requestBids').callsFake((requestParam: IRequestObj) => {
    requestParam.bidsBackHandler!({}, false);
  });
  sandbox.stub(t.context.stubs.apstag, 'fetchBids').callsFake((_bidConfig: IBidConfig, callback: (bids: Object[]) => void) => {
    callback([]);
  });

  // add a bunch of slots
  const adSlots : DfpInPageSlot[] = [
    new DfpQDPPositionSlot('test1', 'pos1', [[2, 2], [1, 1]]),
    new DfpQDPPositionSlot('test2', 'pos2', [[2, 2], [1, 1]]),
    new DfpPrebidSlot(new DfpQDPPositionSlot('prebidslot', 'pos3', [[1, 1]]), [],       {
      banner: {
        sizes: []
      }
    })
  ];
  adSlots.forEach(t.context.addSlot);

  const promise = t.context.dfpService.initialize(adSlots, t.context.adConfiguration, t.context.vertical);

  // call resolve() on promise generated by initAndShowDfp()
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledOnce(pubAdsRefreshSpy);
    Sinon.assert.calledWith(pubAdsRefreshSpy, Sinon.match(adSlots.map(slot => Sinon.match.has('slotId', slot.id))));

    adSlots.forEach(slot => {
      t.truthy(tagDefineSlotStub.withArgs(slot.adUnitPath, slot.size, slot.id).calledOnce);
      t.truthy(displaySpy.withArgs(slot.id).calledOnce);
    });
  });
});

test.serial('DFPService sets vertical targeting to gutefrage.net', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);

  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith( 'vertical', 'gutefrage.net'));
  });
});

test.serial('DFPService sets vertical targeting to reisefrage.net', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const reisefrage: IVertical = {
    platform: 'rf',
    name: 'reisefrage',
    domain: 'reisefrage.net',
    fullDomain: 'www.reisefrage.net',
    facebookId: '0'
  };
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, reisefrage);

  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith( 'vertical', 'reisefrage.net'));
  });
});

test.serial('DFPService sets isAdultContent targeting to false if AdConfiguration says its false', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);

  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith( 'isAdultContent', false.toString()));
  });
});

test.serial('DFPService sets isAdultContent targeting to true if AdConfiguration says its true', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const adConfiguration: IAdNetworkConfiguration = {
    ...t.context.adConfiguration,
    isAdultContent: true
  };
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();

  const promise = t.context.dfpService.initialize([], adConfiguration, t.context.vertical);

  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith( 'isAdultContent', true.toString()));
  });
});

test.serial('DFPService sets support user agent', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const pubadsSetTargetingSpy = sandbox.stub(t.context.stubs.pubads, 'setTargeting').callThrough();
  sandbox.stub(gfUserAgent, 'isSupportedBrowser').returns(true);

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);

  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    t.truthy(pubadsSetTargetingSpy.calledWith( 'supportedUserAgent', 'true'));
  });
});

test.serial('DFPService does not call setRequestNonPersonalizedAds(0) if user opted in', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;

  const pubadsSetRequestNonPersonalizedAdsSpy = sandbox.stub(t.context.stubs.pubads, 'setRequestNonPersonalizedAds').callThrough();
  sandbox.stub(t.context.stubs.cookieService, 'exists').withArgs('_sp_enable_dfp_personalized_ads').returns(true);
  sandbox.stub(t.context.stubs.cookieService, 'get').withArgs('_sp_enable_dfp_personalized_ads').returns('true');

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.notCalled(pubadsSetRequestNonPersonalizedAdsSpy);
    t.pass();
  });
});

test.serial('DFPService setRequestNonPersonalizedAds(1) if user opted out', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;

  const pubadsSetRequestNonPersonalizedAdsSpy = sandbox.stub(t.context.stubs.pubads, 'setRequestNonPersonalizedAds').callThrough();
  sandbox.stub(t.context.stubs.cookieService, 'exists').withArgs('_sp_enable_dfp_personalized_ads').returns(true);
  sandbox.stub(t.context.stubs.cookieService, 'get').withArgs('_sp_enable_dfp_personalized_ads').returns('false');

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledWith(pubadsSetRequestNonPersonalizedAdsSpy, 1);
    t.pass();
  });
});


test.serial('DFPService calls cmpService', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;

  const cmpServiceSpy = sandbox.spy(t.context.stubs.cmpService, 'getConsentData');
  // stub cookie service for consent cookie check
  sandbox.stub(t.context.stubs.cookieService, 'exists').returns(true);
  sandbox.stub(t.context.stubs.assetLoaderService, 'loadAsset').resolves();

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
      Sinon.assert.calledOnce(cmpServiceSpy);
      t.pass();
    });
});

test.serial('DFPService - justpremium skin - never call destroySlots if no skin can be found', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const destroySlotsSpy = sandbox.stub(t.context.stubs.googletag, 'destroySlots');

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.notCalled(destroySlotsSpy);
    // make sure these assertions are called
    t.true(true);
  });
});

test.serial('DFPService - justpremium skin - destroy nothing if ad-sidebar-skyScraper is not present', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const destroySlotsSpy = sandbox.stub(t.context.stubs.googletag, 'destroySlots');
  sandbox.stub(t.context.stubs.queryService, 'elementExists').returns(true);

  const promise = t.context.dfpService.initialize([], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  sandbox.stub(t.context.stubs.pbjs, 'requestBids').callsFake((requestParam: IRequestObj) => {
    requestParam.bidsBackHandler!({
      'ad-presenter-desktop' : {
        bids: [{
            bidder: prebidjs.JustPremium,
            format: prebidjs.JustPremiumWallpaper,
            cpm: 1.0,
            adId: 'adId',
            width: 1,
            height: 1
          }]
      }
    }, false);
  });

  return promise.then(() => {
    Sinon.assert.calledOnce(destroySlotsSpy);
    Sinon.assert.calledWith(destroySlotsSpy, []);
    // make sure these assertions are called
    t.true(true);
  });
});

test.serial('DFPService - justpremium skin - destroy ad-sidebar-skyScraper if present', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  const destroySlotsSpy = sandbox.stub(t.context.stubs.googletag, 'destroySlots');

  const adSlots = [
    new DfpPrebidSlot(
      new DfpSkyScraperSlot('ad-sidebar-skyScraper', []),
      [],
      {
        banner: {
          sizes: []
        }
      }
    )
  ];

  sandbox.stub(t.context.stubs.queryService, 'elementExists').returns(true);

  const promise = t.context.dfpService.initialize(adSlots, t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  sandbox.stub(t.context.stubs.pbjs, 'requestBids').callsFake((requestParam: IRequestObj) => {
    requestParam.bidsBackHandler!({
      'ad-presenter-desktop' : {
        bids: [{
          bidder: prebidjs.JustPremium,
          format: prebidjs.JustPremiumWallpaper,
          cpm: 1.0,
          adId: 'adId',
          width: 1,
          height: 1
        }]
      }
    }, false);
  });

  return promise.then(() => {
    Sinon.assert.calledOnce(destroySlotsSpy);
    Sinon.assert.calledWith(destroySlotsSpy, Sinon.match.every(Sinon.match.has('slotId', 'ad-sidebar-skyScraper')));
    // make sure these assertions are called
    t.true(true);
  });
});

test.serial('DFPService - bidsBackHandler resolves if function inside throws an error', (t: GenericTestContext<IDfpTestContext>) => {
  t.plan(1);
  const sandbox: SinonSandbox = t.context.sandbox;
  sandbox.stub(t.context.stubs.pbjs, 'setTargetingForGPTAsync').throws('error');

  const prebidSlot = new DfpPrebidSlot(
    new DfpSkyScraperSlot('ad-sidebar-skyScraper', []),
    [],
    {
      banner: {
        sizes: []
      }
    }
  );
  sandbox.stub(t.context.stubs.queryService, 'elementExists').returns(true);

  const pubAdsRefreshSpy = sandbox.stub(t.context.stubs.googletag.pubads(), 'refresh');

  const promise = t.context.dfpService.initialize([prebidSlot], t.context.adConfiguration, t.context.vertical);
  t.context.resolveGPT();
  t.context.resolvePrebid();

  return promise.then(() => {
    Sinon.assert.calledOnce(pubAdsRefreshSpy);
    // make sure these assertions are called
    t.true(true);
  });
});
