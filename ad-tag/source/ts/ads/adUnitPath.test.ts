import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

import { removeChildId, withDepth } from './adUnitPath';

// setup sinon-chai
use(sinonChai);

describe('ad unit path', () => {
  describe('remove child network id', () => {
    it('should not change ad unit paths without child network ids', () => {
      ['/1234567/Travel', '/1234567/Travel/Europe', '/1234567/Travel/Europe,Berlin'].forEach(
        adUnitPath => {
          expect(adUnitPath).to.be.equals(removeChildId(adUnitPath));
        }
      );
    });

    it('should remove child network ids', () => {
      [
        ['/1234567,1234/Travel', '/1234567/Travel'],
        ['/1234567,1234/Travel/Berlin', '/1234567/Travel/Berlin'],
        ['/1234567,1234/Travel/Europe,Berlin', '/1234567/Travel/Europe,Berlin'],
        ['/1234567,1234,5678/Travel/Europe,Berlin', '/1234567/Travel/Europe,Berlin']
      ].forEach(([input, expected]) => {
        expect(removeChildId(input)).to.be.equals(expected);
      });
    });
  });
  describe('withDepth', () => {
    it('should not change anything if the adUnit already has the same depth or is smaller', () => {
      ['/1234567/Travel', '/1234567/Travel/Europe'].forEach(adUnitPath => {
        expect(adUnitPath).to.be.equals(withDepth(adUnitPath, 3));
      });
    });

    it('should shorten the adUnitPath', () => {
      [
        ['/1234567/Publisher/Slot', '/1234567/Publisher/Slot'],
        ['/1234567/Publisher/Slot/Device', '/1234567/Publisher/Slot'],
        ['/1234567/Publisher/Slot/Device/Category', '/1234567/Publisher/Slot']
      ].forEach(([input, expected]) => {
        expect(withDepth(input, 3)).to.be.equals(expected);
      });
    });
  });
});
