import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

import { removeChildId, resolveAdUnitPath } from './adUnitPath';

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
          expect(adUnitPath).to.be.equals(resolveAdUnitPath(adUnitPath));
        }
      );
    });

    it('should resolve the entire path if all variables are defined', () => {
      const resolvedPath = resolveAdUnitPath('/1234567/Travel/{device}/{traffic_channel}', {
        device: 'mobile',
        traffic_channel: 'organic'
      });
      expect(resolvedPath).to.be.equals('/1234567/Travel/mobile/organic');
    });

    it('should resolve the entire path if all variables are defined and a variable is used more than once', () => {
      const resolvedPath = resolveAdUnitPath('/1234567/Travel/{device}/{device}-{channel}', {
        device: 'mobile',
        channel: 'finance'
      });
      expect(resolvedPath).to.be.equals('/1234567/Travel/mobile/mobile-finance');
    });

    it('should resolve the entire path if there are unused variables', () => {
      const resolvedPath = resolveAdUnitPath('/1234567/Travel/{device}', {
        device: 'mobile',
        channel: 'finance'
      });
      expect(resolvedPath).to.be.equals('/1234567/Travel/mobile');
    });

    it('should throw an error if a variable is not defined', () => {
      expect(() =>
        resolveAdUnitPath('/1234567/Travel/{device}/{channel}', {
          device: 'mobile'
        })
      ).to.throw(ReferenceError, 'path variable "channel" is not defined');
    });

    ['!', '-', '$', '[', ']', '/', '"', '<', '>'].forEach(invalidChar =>
      it(`should throw an error if a variable contains char ${invalidChar}`, () => {
        expect(() => resolveAdUnitPath(`/1234567/Travel/{${invalidChar}}`, {})).to.throw(
          SyntaxError,
          `invalid variable "${invalidChar}" in path`
        );
      })
    );
  });
});
