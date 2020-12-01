import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import { createDom } from '@highfivve/ad-tag/lib/tests/ts/stubs/browserEnvSetup';
import { AssetLoadMethod, createAssetLoaderService } from '@highfivve/ad-tag';

import Zeotap from './zeotap';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('Zeotap Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  it('should fetch the zeotap script and encode parameters into the URL', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        idpActive: true,
        mode: 'default'
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await module.loadScript('Video Gaming', 'PC Games', [
      'technik',
      'computer',
      'technologie',
      'pc',
      'smartphone',
      'internet'
    ]);

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&ctry=DEU&idp=1&zcat=Video%20Gaming&zscat=PC%20Games&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&z_e_sha2_l=somehashedaddress'
    });
  });

  it('should disable idp if no hashed email address is specified', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: undefined,
        countryCode: 'DEU',
        idpActive: true,
        mode: 'default'
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await module.loadScript('Video Gaming', 'PC Games', [
      'technik',
      'computer',
      'technologie',
      'pc',
      'smartphone',
      'internet'
    ]);

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&ctry=DEU&idp=0&zcat=Video%20Gaming&zscat=PC%20Games&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet'
    });
  });

  it('should disable idp if no idpActive=false', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        idpActive: false,
        mode: 'default'
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await module.loadScript('Technology & Computing', 'Robotics', ['hardware', 'roboter']);

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&ctry=DEU&idp=0&zcat=Technology%20%26%20Computing&zscat=Robotics&zcid=hardware%2Croboter'
    });
  });

  it('should allow multiple loading of the script if running in spa mode', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        idpActive: true,
        mode: 'spa'
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await module.loadScript('Video Gaming', 'PC Games', [
      'technik',
      'computer',
      'technologie',
      'pc',
      'smartphone',
      'internet'
    ]);

    await module.loadScript('Technology & Computing', 'Robotics', ['hardware', 'roboter']);

    expect(loadScriptStub).to.have.been.calledTwice;
    expect(loadScriptStub).to.have.been.calledWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&ctry=DEU&idp=1&zcat=Video%20Gaming&zscat=PC%20Games&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&z_e_sha2_l=somehashedaddress'
    });
    expect(loadScriptStub).to.have.been.calledWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&ctry=DEU&idp=1&zcat=Technology%20%26%20Computing&zscat=Robotics&zcid=hardware%2Croboter&z_e_sha2_l=somehashedaddress'
    });
  });

  it('should only allow loading of the script one time if running in default mode', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        idpActive: true,
        mode: 'default'
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await module.loadScript('Technology & Computing', 'Robotics', ['hardware', 'roboter']);

    return expect(
      module.loadScript('Video Gaming', 'PC Games', [
        'technik',
        'computer',
        'technologie',
        'pc',
        'smartphone',
        'internet'
      ])
    ).eventually.be.rejectedWith("Zeotap module :: can't reload script in default mode.");
  });
});

// tslint:enable
