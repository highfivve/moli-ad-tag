import { expect } from 'chai';
import * as Sinon from 'sinon';
import { getMoliDebugParameter } from './logging';
import { createDom } from '../stubs/browserEnvSetup';
import { googletag } from '../types/googletag';
import { apstag } from '../types/apstag';
import { prebidjs } from '../types/prebidjs';
import { tcfapi } from '../types/tcfapi';

describe('logging', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    apstag.WindowA9 &
    prebidjs.IPrebidjsWindow &
    tcfapi.TCFApiWindow = dom.window as any;

  beforeEach(() => {
    // bring everything back to normal after tests
    sandbox.restore();
    jsDomWindow.sessionStorage.clear();
    jsDomWindow.localStorage.clear();
  });

  describe('getMoliDebugParameter', () => {
    it('should return false as default', () => {
      expect(getMoliDebugParameter(jsDomWindow)).to.be.false;
    });

    it('should return true if moliDebug query param is set', () => {
      dom.reconfigure({
        url: 'https://localhost?moliDebug=true'
      });
      expect(getMoliDebugParameter(jsDomWindow)).to.be.true;
    });

    it('should return true if moliDebug is present as session storage', () => {
      jsDomWindow.sessionStorage.setItem('moliDebug', 'irrelevant');
      expect(getMoliDebugParameter(jsDomWindow)).to.be.true;
    });

    it('should return true if moliDebug is present as locale storage', () => {
      jsDomWindow.localStorage.setItem('moliDebug', 'irrelevant');
      expect(getMoliDebugParameter(jsDomWindow)).to.be.true;
    });
  });
});
