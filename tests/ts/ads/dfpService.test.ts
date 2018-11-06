import browserEnv = require('browser-env');

browserEnv(['window', 'document']);

import { expect } from 'chai';
import * as Sinon from 'sinon';
import { moli } from '../../../source/ts/ads/dfpService';
import { googletag } from '../../../source/ts/types/googletag';


const pubAdsServiceStub: googletag.IPubAdsService = {
  set: (_key: string, _value: string): googletag.IPubAdsService => { return pubAdsServiceStub; },
  setTargeting: (_key: string, _value: string | string[]): googletag.IPubAdsService => { return pubAdsServiceStub; },
  setRequestNonPersonalizedAds: (_value: 0 | 1): googletag.IPubAdsService => { return pubAdsServiceStub; },
  refresh: (slots?: googletag.IAdSlot[], options?: { changeCorrelator: boolean }): void => { return; },
  enableSingleRequest: (): boolean => { return true; },
  enableAsyncRendering: (): boolean => { return true; },
  disableInitialLoad: (): void => { return; },
  getSlots: (): googletag.IAdSlot[] => { return []; },
  addEventListener: (_eventType: string, _listener: (event: any) => void): googletag.IPubAdsService => {
    return pubAdsServiceStub;
  }
};

const googletagStub: googletag.IGoogleTag = {
  cmd: [],
  defineSlot: (_adUnitPath: string, _size: googletag.Size[], _slotId: string): googletag.IAdSlot => { throw new Error('stub'); },
  defineOutOfPageSlot: (_adUnitPath: string, _slotId: string): googletag.IAdSlot => { throw new Error('stub'); },
  destroySlots: (_opt_slots: googletag.IAdSlot[]): void => { return; },
  display: (_id: string): void => { return; },
  enableServices: (): void => { return; },
  pubads: (): googletag.IPubAdsService => pubAdsServiceStub
};

// tslint:disable: no-unused-expression
describe('moli', () => {
  const sandbox = Sinon.createSandbox();

  afterEach(() => {
    sandbox.reset();
  });

  it('should have been exported', () => {
    expect(moli).to.be.ok;
  });

});
// tslint:enable
