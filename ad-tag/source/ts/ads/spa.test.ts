import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { allowRefreshAdSlots } from './spa';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('spa', () => {
  describe('allowRefreshAdSlots', () => {
    /* create a fake location for testing. add properties as needed  */
    const fakeLocation = (href: string): Location => {
      const location = new URL(href);
      return {
        href: href,
        pathname: location.pathname,
        host: location.host
      } as any;
    };

    describe('validateLocation is none', () => {
      it('should return true when validateLocation is none and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRefreshAdSlots('none', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return true when validateLocation is none and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlots('none', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });
    });
    describe('validateLocation is href', () => {
      it('should return true when validateLocation is href and href is identical', () => {
        const stateHref = 'https://example.com';
        expect(allowRefreshAdSlots('href', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return false when validateLocation is href and hrefs differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlots('href', stateHref1, fakeLocation(stateHref2))).to.be.false;
      });
    });

    describe('validateLocation is path', () => {
      it('should return true when validateLocation is path and paths are identical', () => {
        const stateHref = 'https://example.com/path/1';
        expect(allowRefreshAdSlots('path', stateHref, fakeLocation(stateHref))).to.be.true;
      });

      it('should return true when validateLocation is path and paths are identical with different query params', () => {
        const stateHref1 = 'https://example.com/path/1?foo=bar';
        const stateHref2 = 'https://example.com/path/1?foo=baz';
        expect(allowRefreshAdSlots('path', stateHref1, fakeLocation(stateHref2))).to.be.true;
      });

      it('should return false when validateLocation is path and paths differ', () => {
        const stateHref1 = 'https://example.com/path/1';
        const stateHref2 = 'https://example.com/path/2';
        expect(allowRefreshAdSlots('path', stateHref1, fakeLocation(stateHref2))).to.be.false;
      });

      it('should return true when validateLocation is path and the href is an invalid url', () => {
        const stateHref: any = null;
        expect(allowRefreshAdSlots('path', stateHref, fakeLocation('https://example.com'))).to.be
          .true;
      });
    });
  });
});
