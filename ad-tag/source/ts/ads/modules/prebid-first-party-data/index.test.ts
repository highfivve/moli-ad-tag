import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { createPbjsStub, pbjsTestConfig } from 'ad-tag/stubs/prebidjsStubs';

import { prebidjs } from 'ad-tag/types/prebidjs';
import { PrebidFirstPartyDataModule } from './index';
import { AdPipelineContext } from '../../adPipeline';
import { googleAdManager, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { dummySchainConfig } from 'ad-tag/stubs/schainStubs';
import PrebidFirstPartyData = prebidjs.firstpartydata.PrebidFirstPartyData;
import OpenRtb2Site = prebidjs.firstpartydata.OpenRtb2Site;
import OpenRtb2User = prebidjs.firstpartydata.OpenRtb2User;

use(sinonChai);
use(chaiAsPromised);

describe('Prebid First Party Data Module', () => {
  const sandbox = Sinon.createSandbox();
  let { dom, jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const adPipelineContext = (config: MoliConfig): AdPipelineContext => {
    return {
      auctionId: 'xxxx-xxxx-xxxx-xxxx',
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService: assetLoaderService
    };
  };

  beforeEach(() => {
    jsDomWindow.pbjs = createPbjsStub();
  });

  afterEach(() => {
    const result = createDomAndWindow();
    jsDomWindow = result.jsDomWindow;
    dom = result.dom;
    sandbox.reset();
    sandbox.restore();
  });

  const createFpdModule = (
    staticPrebidFirstPartyData: prebidjs.firstpartydata.PrebidFirstPartyData,
    gptTargetingMappings?: modules.prebid_first_party_data.GptTargetingMapping,
    iabDataProviderName?: string
  ) => {
    const module = new PrebidFirstPartyDataModule();

    module.configure({
      prebidFirstPartyData: {
        enabled: true,
        staticPrebidFirstPartyData,
        gptTargetingMappings,
        iabDataProviderName
      }
    });
    return { module, configureStep: module.configureSteps()[0] };
  };

  const configWithTargeting = (targeting: googleAdManager.Targeting): MoliConfig => ({
    ...emptyConfig,
    targeting,
    prebid: {
      config: pbjsTestConfig,
      schain: { nodes: [] }
    },
    schain: dummySchainConfig
  });

  describe('configure', () => {
    it('should add a configure step', () => {
      const { module } = createFpdModule({}, { cat: 'openrtb2_page_cat' });

      const configureSteps = module.configureSteps();

      expect(configureSteps).to.have.lengthOf(1);
      expect(configureSteps[0].name).to.be.equals('prebid-fpd-module-configure');
    });
  });

  describe('configure step', () => {
    let setConfigSpy: Sinon.SinonSpy<[Partial<prebidjs.IPrebidJsConfig>], void>;

    beforeEach(() => {
      setConfigSpy = sandbox.spy(jsDomWindow.pbjs, 'setConfig');
    });

    it('should call pbjs.setConfig() with the configured first party data', async () => {
      const { configureStep } = createFpdModule(
        { user: { gender: 'O', yob: 1337, keywords: 'some,nice,guy' } },
        { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat', iabV3: 'iab_v3', iabV2: 'iab_v2' },
        'test.com'
      );

      const moliConfig: MoliConfig = configWithTargeting({
        keyValues: {
          openrtb2_cat: ['IAB-1'],
          openrtb2_page_cat: ['IAB-1', 'IAB-123'],
          iab_v3: ['123', '456'],
          iab_v2: ['111', '222']
        }
      });

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
                ext: { segtax: 6 },
                segment: [{ id: '111' }, { id: '222' }]
              },
              {
                name: 'test.com',
                ext: { segtax: 7 },
                segment: [{ id: '123' }, { id: '456' }]
              }
            ]
          }
        },
        user: { gender: 'O', yob: 1337, keywords: 'some,nice,guy' }
      };
      expect(setConfigSpy).to.have.been.calledOnce;
      expect(setConfigSpy).to.have.been.calledOnceWithExactly({
        ortb2: expected
      });
    });

    describe('iab provider name', () => {
      const iabProviderMoliConfig: MoliConfig = configWithTargeting({
        keyValues: { iab_v3: ['123', '456'] }
      });

      it('should use the configured iabDataProviderName', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', iabV3: 'iab_v3' },
          'test.com'
        );

        await configureStep(adPipelineContext(iabProviderMoliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.content?.data?.map(value => value.name)).to.deep.equals(['test.com']);
      });

      it('should use the tld as iabDataProviderName if none is configured', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', iabV3: 'iab_v3', iabV2: 'iab_v2' }
        );
        dom.reconfigure({
          url: 'https://www.test.com'
        });

        await configureStep(adPipelineContext(iabProviderMoliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.content?.data?.map(value => value.name)).to.deep.equals([
          'test.com',
          'test.com'
        ]);
      });
    });

    describe('iab category fallbacks', () => {
      it('should not set any iab categories if none is configured', async () => {
        const { configureStep } = createFpdModule({});

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-1'],
            openrtb2_page_cat: ['IAB-2']
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy.firstCall.firstArg.ortb2.site).to.be.undefined;
      });

      it('should use cat as fallback for pagecat', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', sectionCat: 'openrtb2_section_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-1'],
            openrtb2_section_cat: ['IAB-2']
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
        expect(site.pagecat).to.deep.equals(['IAB-1']);
        expect(site.sectioncat).to.deep.equals(['IAB-2']);
      });

      it('should use cat as fallback for sectioncat', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-1'],
            openrtb2_page_cat: ['IAB-2']
          }
        });

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
        const { configureStep } = createFpdModule({}, { iabV3: 'iab_v3' }, 'test.com');

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            iab_v3: ['123', '456']
          }
        });

        readConfigStub.returns({
          ortb2: {
            site: {
              content: {
                data: [
                  {
                    name: 'test2.com',
                    ext: { segtax: 7 },
                    segment: [{ id: 'xxx' }, { id: 'yyy' }]
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
                  ext: { segtax: 7 },
                  segment: [{ id: 'xxx' }, { id: 'yyy' }]
                },
                { name: 'test.com', ext: { segtax: 7 }, segment: [{ id: '123' }, { id: '456' }] }
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
        const { configureStep } = createFpdModule(
          { user: { keywords: 'static' }, site: { cat: ['IAB-9'] } },
          { cat: 'openrtb2_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({ keyValues: {} });

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
        const { configureStep } = createFpdModule({}, { cat: 'openrtb2_cat' });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-9']
          }
        });

        readConfigStub.returns({
          ortb2: {
            user: { keywords: 'existing' },
            site: { cat: ['IAB-1'] }
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1', 'IAB-9']);
        expect(site.sectioncat).to.deep.equals(['IAB-9']);
        expect(site.pagecat).to.deep.equals(['IAB-9']);
      });

      it('should keep data in site.ext.data', async () => {
        const { configureStep } = createFpdModule({}, { cat: 'openrtb2_cat' });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-9']
          }
        });

        readConfigStub.returns({
          ortb2: {
            site: { ext: { data: { pagetype: 'my-page', category: 'my-cateogry' } } }
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.ext?.data?.pagetype).to.deep.equals('my-page');
        expect(site.ext?.data?.category).to.deep.equals('my-cateogry');
      });

      it('should write unique values', async () => {
        const { configureStep } = createFpdModule({}, { cat: 'openrtb2_cat' });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {
            openrtb2_cat: ['IAB-1']
          }
        });

        readConfigStub.returns({
          ortb2: {
            user: { keywords: 'existing' },
            site: { cat: ['IAB-1'] }
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
      });
    });
  });
});
