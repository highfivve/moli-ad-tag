import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

import { removeChildId, resolvedPath, AdUnitPathVariables } from './adUnitPath';

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

  describe('dynamic ad unit path', () => {
    it('should return the same ad unit path when there are no variables', () => {
      ['/1234567/Travel', '/1234567/Travel/Europe', '/1234567/Travel/Europe,Berlin'].forEach(
        adUnitPath => {
          expect(adUnitPath).to.be.equals(resolvedPath(adUnitPath));
        }
      );
    });

    it('should return "/1234567/Travel/mobile/finance" when there are device and category variables', () => {
      const adUnitPath = '/1234567/Travel';
      const expectedAdUnitPath = '/1234567/Travel/mobile/finance';
      const variables = { device: 'mobile', category: 'finance' };
      expect(expectedAdUnitPath).to.be.equals(resolvedPath(adUnitPath, variables));
    });
  });
});
