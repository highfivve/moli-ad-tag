import browserEnv = require('browser-env');

browserEnv(['window', 'document']);

import { expect } from 'chai';
import { moli } from '../../../source/ts/ads/dfpService';

describe('moli', () => {
  it('should have been exported', () => {
    expect(moli).to.be.ok;
  });
});
