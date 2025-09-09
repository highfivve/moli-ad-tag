import { expect, use } from 'chai';
import { uuidV4 } from 'ad-tag/util/uuid';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';

use(sinonChai);

describe('uuid', () => {
  const sandbox = Sinon.createSandbox();

  let dom = createDom();
  let jsDomWindow = dom.window as any as Window;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any as Window;
  });

  it('should generate a valid uuid if window.crypto.randomUUID is not available', () => {
    expect(jsDomWindow.crypto).to.be.undefined;
    for (let i = 0; i < 100; i++) {
      const uuid = uuidV4(jsDomWindow);
      expect(uuid).to.match(uuidRegex);
    }
  });

  it('should use window.crypto.randomUUID if available', () => {
    const cryptoMock: Crypto = {
      randomUUID: () => '1234'
    } as any;
    (jsDomWindow as any).crypto = cryptoMock;

    const randomUUIDStub = sandbox
      .stub(jsDomWindow.crypto, 'randomUUID')
      .returns('486b1d93-e295-4b49-95fe-40fdd7fd0d81');

    expect(uuidV4(jsDomWindow)).to.be.equal('486b1d93-e295-4b49-95fe-40fdd7fd0d81');
    expect(randomUUIDStub).to.be.calledOnce;
  });
});
