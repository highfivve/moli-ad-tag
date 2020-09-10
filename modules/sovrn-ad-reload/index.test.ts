import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import SovrnAdReload from './index';
import { createDom } from '@highfivve/ad-tag/lib/tests/ts/stubs/browserEnvSetup';
import { AssetLoadMethod, createAssetLoaderService } from '@highfivve/ad-tag';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Sovrn Ad Reload Module', () => {

  const sandbox = Sinon.createSandbox();
  let dom = createDom();

  afterEach(() => {
    dom = createDom();
    sandbox.reset();
  });



  it('should fetch the sovrn script', () => {
    const assetLoader = createAssetLoaderService(dom.window);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new SovrnAdReload({
      assetUrl: 'http://localhost/tag.js'
    }, dom.window);

    module.init({} as any, assetLoader);

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: 'http://localhost/tag.js'
    });

  });
});

// tslint:enable
