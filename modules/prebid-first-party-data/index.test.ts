import {
  AdPipeline,
  AdPipelineContext,
  createAssetLoaderService,
  googletag,
  IAdPipelineConfiguration,
  Moli,
  prebidjs
} from '@highfivve/ad-tag';

import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { fullConsent } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { createPbjsStub, moliPrebidTestConfig } from '@highfivve/ad-tag/lib/stubs/prebidjsStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/stubs/reportingServiceStub';
import { expect, use } from 'chai';

import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GptTargetingMapping, PrebidFirstPartyDataModule } from './index';
import PrebidFirstPartyData = prebidjs.firstpartydata.PrebidFirstPartyData;
import OpenRtb2Site = prebidjs.firstpartydata.OpenRtb2Site;
import OpenRtb2User = prebidjs.firstpartydata.OpenRtb2User;
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';

use(sinonChai);
use(chaiAsPromised);

describe('Prebid First Party Data Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const reportingService = reportingServiceStub();
  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };
  const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow)
    };
  };

  beforeEach(() => {
    jsDomWindow.pbjs = createPbjsStub();
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
    sandbox.restore();
  });

  const createFpdModule = (
    staticPrebidFirstPartyData: prebidjs.firstpartydata.PrebidFirstPartyData,
    gptTargetingMappings?: GptTargetingMapping,
    iabDataProviderName?: string
  ): PrebidFirstPartyDataModule => {
    return new PrebidFirstPartyDataModule(
      {
        staticPrebidFirstPartyData,
        gptTargetingMappings,
        iabDataProviderName
      },
      jsDomWindow
    );
  };

  const initModule = (module: PrebidFirstPartyDataModule) => {
    const configPipeline = {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const targeting: Moli.Targeting = {
      keyValues: {}
    };

    const moliConfig: Moli.MoliConfig = {
      slots: [],
      pipeline: configPipeline,
      targeting,
      prebid: moliPrebidTestConfig,
      schain: dummySchainConfig,
      logger: noopLogger
    };

    const adPipeline = new AdPipeline(
      emptyPipelineConfig,
      noopLogger,
      jsDomWindow,
      reportingService,
      new GlobalAuctionContext(jsDomWindow)
    );

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    const configureStep = moliConfig.pipeline!.configureSteps[0];

    return { moliConfig, adPipeline, targeting, configureStep };
  };

  describe('init', () => {
    it('should add a configure step', () => {
      const module = createFpdModule({}, { cat: 'openrtb2_page_cat' });

      const {
        moliConfig: { pipeline }
      } = initModule(module);

      expect(pipeline).to.be.ok;
      expect(pipeline?.configureSteps).to.have.lengthOf(1);
      expect(pipeline!.configureSteps[0].name).to.be.equals('prebid-fpd-module-configure');
    });
  });

  describe('configure step', () => {
    let setConfigSpy: Sinon.SinonSpy<[Partial<prebidjs.IPrebidJsConfig>], void>;

    beforeEach(() => {
      setConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'setConfig');
    });

    it('should call pbjs.setConfig() with the configured first party data', async () => {
      const module = createFpdModule(
        { user: { gender: 'O', yob: 1337, keywords: 'some,nice,guy' } },
        { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat', iabV3: 'iab_v3', iabV2: 'iab_v2' },
        'test.com'
      );

      const { moliConfig, targeting, configureStep } = initModule(module);
      targeting.keyValues.openrtb2_cat = ['IAB-1'];
      targeting.keyValues.openrtb2_page_cat = ['IAB-1', 'IAB-123'];
      targeting.keyValues.iab_v3 = ['123', '456'];
      targeting.keyValues.iab_v2 = ['111', '222'];

      await configureStep(adPipelineContext(moliConfig), []);

      const expected: PrebidFirstPartyData = {
        site: {
          cat: ['IAB-1'],
          sectioncat: ['IAB-1'],
          pagecat: ['IAB-1', 'IAB-123'],
          content: {
            data: [
              {
                name: 'test.com',
                ext: {
                  segtax: 6
                },
                segment: [
                  {
                    id: '111'
                  },
                  {
                    id: '222'
                  }
                ]
              },
              {
                name: 'test.com',
                ext: {
                  segtax: 7
                },
                segment: [
                  {
                    id: '123'
                  },
                  {
                    id: '456'
                  }
                ]
              }
            ]
          }
        },
        user: {
          gender: 'O',
          yob: 1337,
          keywords: 'some,nice,guy'
        }
      };
      expect(setConfigSpy).to.have.been.calledOnce;
      expect(setConfigSpy).to.have.been.calledOnceWithExactly({
        ortb2: expected
      });
    });

    describe('iab category fallbacks', () => {
      it('should not set any iab categories if none is configured', async () => {
        const module = createFpdModule({});
        const { moliConfig, targeting, configureStep } = initModule(module);
        targeting.keyValues.openrtb2_cat = ['IAB-1'];
        targeting.keyValues.openrtb2_section_cat = ['IAB-2'];

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy.firstCall.firstArg.ortb2.site).to.be.undefined;
      });

      it('should use cat as fallback for pagecat', async () => {
        const module = createFpdModule(
          {},
          { cat: 'openrtb2_cat', sectionCat: 'openrtb2_section_cat' }
        );
        const { moliConfig, targeting, configureStep } = initModule(module);
        targeting.keyValues.openrtb2_cat = ['IAB-1'];
        targeting.keyValues.openrtb2_section_cat = ['IAB-2'];

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
        expect(site.pagecat).to.deep.equals(['IAB-1']);
        expect(site.sectioncat).to.deep.equals(['IAB-2']);
      });

      it('should use cat as fallback for sectioncat', async () => {
        const module = createFpdModule({}, { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat' });
        const { moliConfig, targeting, configureStep } = initModule(module);
        targeting.keyValues.openrtb2_cat = ['IAB-1'];
        targeting.keyValues.openrtb2_page_cat = ['IAB-2'];

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
        expect(site.sectioncat).to.deep.equals(['IAB-1']);
        expect(site.pagecat).to.deep.equals(['IAB-2']);
      });
    });

    describe('site.content.data merge behaviour', () => {
      let readConfigStub: Sinon.SinonStub<[], Partial<prebidjs.IPrebidJsConfig>>;

      beforeEach(() => {
        readConfigStub = sandbox.stub(jsDomWindow.pbjs, 'readConfig');
      });

      it('should filter all data rows from configured iabDataProviderName to avoid duplicates', async () => {
        const module = createFpdModule({}, { iabV3: 'iab_v3' }, 'test.com');

        const { moliConfig, targeting, configureStep } = initModule(module);
        targeting.keyValues.iab_v3 = ['123', '456'];

        readConfigStub.returns({
          ortb2: {
            site: {
              content: {
                data: [
                  {
                    name: 'test2.com',
                    ext: {
                      segtax: 7
                    },
                    segment: [
                      {
                        id: 'xxx'
                      },
                      {
                        id: 'yyy'
                      }
                    ]
                  }
                ]
              }
            }
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        const expected: PrebidFirstPartyData = {
          site: {
            cat: [],
            sectioncat: [],
            pagecat: [],
            content: {
              data: [
                {
                  name: 'test2.com',
                  ext: {
                    segtax: 7
                  },
                  segment: [
                    {
                      id: 'xxx'
                    },
                    {
                      id: 'yyy'
                    }
                  ]
                },
                {
                  name: 'test.com',
                  ext: {
                    segtax: 7
                  },
                  segment: [
                    {
                      id: '123'
                    },
                    {
                      id: '456'
                    }
                  ]
                }
              ]
            }
          }
        };

        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ortb2: expected
        });
      });
    });

    describe('ortb2 merge behaviour', () => {
      let readConfigStub: Sinon.SinonStub<[], Partial<prebidjs.IPrebidJsConfig>>;

      beforeEach(() => {
        readConfigStub = sandbox.stub(jsDomWindow.pbjs, 'readConfig');
      });

      it('should prefer key value data over static data', async () => {
        const module = createFpdModule(
          { user: { keywords: 'static' }, site: { cat: ['IAB-9'] } },
          { cat: 'openrtb2_cat' }
        );
        const { moliConfig, configureStep } = initModule(module);
        readConfigStub.returns({
          ortb2: {
            user: { keywords: 'existing' },
            site: { cat: ['IAB-1'] }
          }
        });
        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        const user = setConfigSpy.firstCall.firstArg.ortb2.user as OpenRtb2User;
        expect(site.cat).to.deep.equals(['IAB-9', 'IAB-1']);
        expect(user.keywords).to.be.equals('existing');
      });

      it('should prefer existing fpd data over key value data', async () => {
        const module = createFpdModule({}, { cat: 'openrtb2_cat' });
        const { moliConfig, targeting, configureStep } = initModule(module);
        readConfigStub.returns({
          ortb2: {
            user: { keywords: 'existing' },
            site: { cat: ['IAB-1'] }
          }
        });
        targeting.keyValues.openrtb2_cat = ['IAB-9'];

        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1', 'IAB-9']);
        expect(site.sectioncat).to.deep.equals(['IAB-9']);
        expect(site.pagecat).to.deep.equals(['IAB-9']);
      });

      it('should write unique values', async () => {
        const module = createFpdModule({}, { cat: 'openrtb2_cat' });
        const { moliConfig, targeting, configureStep } = initModule(module);
        readConfigStub.returns({
          ortb2: {
            user: { keywords: 'existing' },
            site: { cat: ['IAB-1'] }
          }
        });
        targeting.keyValues.openrtb2_cat = ['IAB-1'];

        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
      });
    });
  });
});
