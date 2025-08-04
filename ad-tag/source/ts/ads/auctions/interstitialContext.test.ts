import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

use(sinonChai);

describe('InterstitialContext', () => {
  const sandbox = Sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  // TODO write all the tests
  describe('gam only setup', () => {
    expect(true).to.be.false; // Placeholder for actual tests
  });
});
