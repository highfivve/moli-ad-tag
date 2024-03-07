import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { allowRefreshAdSlot, allowRequestAds } from './spa';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('spa', () => {
  /* create a fake location for testing. add properties as needed  */
  const fakeLocation = (href: string): Location => {
    const location = new URL(href);
    return {
      href: href,
      pathname: location.pathname,
      host: location.host
    } as any;
  };
  describe('allowRefreshOrRequestAds', () => {
    describe('validateLocation is none', () => {
      it('should return true when validateLocation is none and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRefreshAdSlot('none', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return true when validateLocation is none and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlot('none', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });
    });
    describe('validateLocation is href', () => {
      it('should return true when validateLocation is href and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRefreshAdSlot('href', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return false when validateLocation is href and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlot('href', stateHref1, fakeLocation(stateHref2))).to.be.false;
      });
    });

    describe('validateLocation is path', () => {
      it('should return true when validateLocation is path and paths are identical', () => {
        const stateHref = 'https://example.com/path/1';
        expect(allowRefreshAdSlot('path', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return true when validateLocation is path and paths are identical with different query params', () => {
        const stateHref1 = 'https://example.com/path/1?foo=bar';
        const stateHref2 = 'https://example.com/path/1?foo=baz';
        expect(allowRefreshAdSlot('path', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });

      it('should return false when validateLocation is path and paths differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlot('path', stateHref1, fakeLocation(stateHref2))).to.be.false;
      });

      it('should return true when validateLocation is path and the href is an invalid url', () => {
        const stateHref: any = null;
        expect(allowRefreshAdSlot('path', stateHref, fakeLocation('https://example.com'))).to.be
          .true;
      });
    });
  });

  describe('allowRequestAds', () => {
    describe('validateLocation is none', () => {
      it('should return true when validateLocation is none and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRequestAds('none', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return true when validateLocation is none and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRequestAds('none', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });
    });
    describe('validateLocation is href', () => {
      it('should return false when validateLocation is href and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRequestAds('href', stateHref, fakeLocation(stateHref))).to.be.false;
      });

      it('should return true when validateLocation is href and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRequestAds('href', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });
    });

    describe('validateLocation is path', () => {
      it('should return false when validateLocation is path and paths are identical', () => {
        const stateHref = 'https://example.com/path/1';
        expect(allowRequestAds('path', stateHref, fakeLocation(stateHref))).to.be.false;
      });

      it('should return false when validateLocation is path and paths are identical with different query params', () => {
        const stateHref1 = 'https://example.com/path/1?foo=bar';
        const stateHref2 = 'https://example.com/path/1?foo=baz';
        expect(allowRequestAds('path', stateHref1, fakeLocation(stateHref2))).to.be.false;
      });

      it('should return true when validateLocation is path and paths differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRequestAds('path', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });
    });
  });
});
