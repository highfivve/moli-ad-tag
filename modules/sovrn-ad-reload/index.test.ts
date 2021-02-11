import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SovrnAdReload from './index';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import {
  AssetLoadMethod,
  createAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

// setup sinon-chai
use(sinonChai);

describe('Sovrn Ad Reload Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  it('should fetch the sovrn script', () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();

    const module = new SovrnAdReload({
      assetUrl: 'http://localhost/tag.js'
    });

    module.init({} as any, assetLoader);

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: 'http://localhost/tag.js'
    });
  });
});
