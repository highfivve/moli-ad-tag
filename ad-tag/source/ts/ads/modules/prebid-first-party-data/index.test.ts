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
import { createPrebidFirstPartyDataModule } from './index';
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
  const adPipelineContext = (
    config: MoliConfig,
    runtimeKeyValues: googleAdManager.KeyValueMap = {}
  ): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: 1,
      env__: 'production',
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: { ...emptyRuntimeConfig, keyValues: runtimeKeyValues },
      window__: jsDomWindow,
      // no service dependencies required
      labelConfigService__: null as any,
      tcData__: fullConsent(),
      adUnitPathVariables__: {},
      auction__: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService__: assetLoaderService
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
    const module = createPrebidFirstPartyDataModule();

    module.configure__({
      prebidFirstPartyData: {
        enabled: true,
        staticPrebidFirstPartyData,
        gptTargetingMappings,
        iabDataProviderName
      }
    });
    return { module, configureStep: module.configureSteps__()[0] };
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

      const configureSteps = module.configureSteps__();

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

    describe('runtime key values', () => {
      it('should read a key-value that only exists at runtime', async () => {
        const { configureStep } = createFpdModule({}, { cat: 'openrtb2_cat' });

        const moliConfig: MoliConfig = configWithTargeting({ keyValues: {} });

        await configureStep(adPipelineContext(moliConfig, { openrtb2_cat: ['IAB-1'] }), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
      });

      it('should let a runtime key-value replace the static one of the same key', async () => {
        const { configureStep } = createFpdModule({}, { cat: 'openrtb2_cat' });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: { openrtb2_cat: ['IAB-1'] }
        });

        await configureStep(adPipelineContext(moliConfig, { openrtb2_cat: ['IAB-2'] }), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-2']);
      });

      it('should keep static key-values that the runtime config does not define', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: { openrtb2_cat: ['IAB-1'], openrtb2_page_cat: ['IAB-3'] }
        });

        await configureStep(adPipelineContext(moliConfig, { openrtb2_cat: ['IAB-2'] }), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-2']);
        expect(site.pagecat).to.deep.equals(['IAB-3']);
      });
    });

    describe('mapped targets without a key-value', () => {
      it('should keep the cat cross-fill if the pageCat key-value is absent', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', pageCat: 'openrtb2_page_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: { openrtb2_cat: ['IAB-1'] }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
        expect(site.pagecat).to.deep.equals(['IAB-1']);
        expect(site.sectioncat).to.deep.equals(['IAB-1']);
      });

      it('should keep the cat cross-fill if the sectionCat key-value is absent', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', sectionCat: 'openrtb2_section_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: { openrtb2_cat: ['IAB-1'] }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-1']);
        expect(site.sectioncat).to.deep.equals(['IAB-1']);
        expect(site.pagecat).to.deep.equals(['IAB-1']);
      });

      it('should keep the static first party data categories if the key-values are absent', async () => {
        const { configureStep } = createFpdModule(
          { site: { sectioncat: ['IAB-7'], pagecat: ['IAB-8'] } },
          { sectionCat: 'openrtb2_section_cat', pageCat: 'openrtb2_page_cat' }
        );

        const moliConfig: MoliConfig = configWithTargeting({ keyValues: {} });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnce;
        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.sectioncat).to.deep.equals(['IAB-7']);
        expect(site.pagecat).to.deep.equals(['IAB-8']);
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

    describe('targeting.ortb2 as the merge base', () => {
      let readConfigStub: Sinon.SinonStub<[], Partial<prebidjs.IPrebidJsConfig>>;

      beforeEach(() => {
        readConfigStub = sandbox.stub(jsDomWindow.pbjs, 'readConfig');
        readConfigStub.returns({});
      });

      it('should pass a static targeting.ortb2 through to prebid', async () => {
        const { configureStep } = createFpdModule({});

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {},
          ortb2: {
            site: {
              content: { title: 'How do I bake bread?', producer: { name: 'baker42' } }
            }
          }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ortb2: {
            site: { content: { title: 'How do I bake bread?', producer: { name: 'baker42' } } }
          }
        });
      });

      it('should let the module static first party data win over targeting.ortb2 on scalars', async () => {
        const { configureStep } = createFpdModule({ site: { content: { title: 'module' } } });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {},
          ortb2: { site: { content: { title: 'targeting', language: 'de' } } }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.content?.title).to.be.equals('module');
        // branches the module config does not mention survive
        expect(site.content?.language).to.be.equals('de');
      });

      it('should let what prebid already holds win over targeting.ortb2', async () => {
        const { configureStep } = createFpdModule({});

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {},
          ortb2: { site: { content: { title: 'targeting' } } }
        });

        readConfigStub.returns({ ortb2: { site: { content: { title: 'existing' } } } });

        await configureStep(adPipelineContext(moliConfig), []);

        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.content?.title).to.be.equals('existing');
      });

      it('should concatenate arrays of all three layers, base first', async () => {
        const { configureStep } = createFpdModule({ site: { cat: ['IAB-module'] } });

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {},
          ortb2: { site: { cat: ['IAB-targeting'] } }
        });

        readConfigStub.returns({ ortb2: { site: { cat: ['IAB-existing'] } } });

        await configureStep(adPipelineContext(moliConfig), []);

        const site = setConfigSpy.firstCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-targeting', 'IAB-module', 'IAB-existing']);
      });

      it('should not send the runtime half of ortb2 to prebid', async () => {
        const { configureStep } = createFpdModule({});

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: {},
          ortb2: { site: { content: { title: 'static' } } }
        });

        const context = adPipelineContext(moliConfig);
        await configureStep(
          {
            ...context,
            runtimeConfig__: {
              ...context.runtimeConfig__,
              ortb2: { site: { content: { title: 'runtime', url: 'https://example.com/1' } } }
            }
          },
          []
        );

        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ortb2: { site: { content: { title: 'static' } } }
        });
      });

      it('should leave the key-value category mappings untouched when targeting.ortb2 is set', async () => {
        const { configureStep } = createFpdModule(
          {},
          { cat: 'openrtb2_cat', iabV2: 'iab_v2' },
          'test.com'
        );

        const moliConfig: MoliConfig = configWithTargeting({
          keyValues: { openrtb2_cat: ['IAB-1'], iab_v2: ['111', '222'] },
          ortb2: { site: { content: { title: 'How do I bake bread?' } } }
        });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ortb2: {
            site: {
              cat: ['IAB-1'],
              sectioncat: ['IAB-1'],
              pagecat: ['IAB-1'],
              content: {
                title: 'How do I bake bread?',
                data: [
                  { name: 'test.com', ext: { segtax: 6 }, segment: [{ id: '111' }, { id: '222' }] }
                ]
              }
            }
          }
        });
      });

      it('should change nothing for a publisher who sets neither', async () => {
        const { configureStep } = createFpdModule({ user: { keywords: 'static' } });

        const moliConfig: MoliConfig = configWithTargeting({ keyValues: {} });

        await configureStep(adPipelineContext(moliConfig), []);

        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ortb2: { user: { keywords: 'static' } }
        });
      });

      it('should not mutate the static targeting.ortb2 across two configure runs', async () => {
        const { configureStep } = createFpdModule({ site: { cat: ['IAB-module'] } });

        const ortb2 = { site: { cat: ['IAB-targeting'] } };
        const moliConfig: MoliConfig = configWithTargeting({ keyValues: {}, ortb2 });

        await configureStep(adPipelineContext(moliConfig), []);
        await configureStep(adPipelineContext(moliConfig), []);

        expect(ortb2.site.cat).to.deep.equals(['IAB-targeting']);
        const site = setConfigSpy.secondCall.firstArg.ortb2.site as OpenRtb2Site;
        expect(site.cat).to.deep.equals(['IAB-targeting', 'IAB-module']);
      });
    });
  });
});
