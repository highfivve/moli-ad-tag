import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import {
  AssetLoadMethod,
  createAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { ATS } from '@highfivve/ad-tag/source/ts/types/identitylink';

import IdentityLink from './index';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('IdentityLink Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: ATS.Window = dom.window as any;

  it('should fetch the ats script and start window.ats', async () => {
    const assetLoader = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoader, 'loadScript').resolves();
    const atsStartStub = sandbox.stub();

    jsDomWindow.ats = {
      retrieveEnvelope: sandbox.stub(),
      start: atsStartStub,
      triggerDetection: sandbox.stub()
    };

    const module = new IdentityLink(
      {
        assetUrl: 'http://localhost/ats.js',
        hashedEmailAddresses: ['somehashedaddress'],
        placementId: 1337
      },
      jsDomWindow
    );

    module.init({} as any, assetLoader);

    await loadScriptStub;

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: 'http://localhost/ats.js'
    });

    expect(atsStartStub).to.have.been.calledOnceWithExactly({
      placementID: 1337,
      storageType: 'localStorage',
      emailHashes: ['somehashedaddress'],
      logging: 'error'
    });
  });
});

// tslint:enable
