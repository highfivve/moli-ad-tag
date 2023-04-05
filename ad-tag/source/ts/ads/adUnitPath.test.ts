import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

import {
  generateAdUnitPathVariables,
  removeChildId,
  resolveAdUnitPath,
  withDepth
} from './adUnitPath';

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

    it('should replace only the variables in curly braces', () => {
      const resolvedPath = resolveAdUnitPath('/1234567/device/{device}/{channel}', {
        device: 'mobile',
        channel: 'finance'
      });
      expect(resolvedPath).to.be.equals('/1234567/device/mobile/finance');
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

describe('generate ad unit path variables', () => {
  it('should return hostname and device if varsFromConfig are undefined', () => {
    const vars = generateAdUnitPathVariables('example.com', 'mobile');
    expect(vars.domain).to.be.equals('example.com');
    expect(vars.device).to.be.equals('mobile');
  });

  it('should return hostname unknown for invalid hostname', () => {
    const vars = generateAdUnitPathVariables('', 'desktop');
    expect(vars.domain).to.be.equals('unknown');
    expect(vars.device).to.be.equals('desktop');
  });

  it('should merge varsFromConfig with hostname and domain', () => {
    const vars = generateAdUnitPathVariables('example.com', 'mobile', { channel: 'seo' });
    expect(vars.domain).to.be.equals('example.com');
    expect(vars.device).to.be.equals('mobile');
    expect(vars.channel).to.be.equals('seo');
  });

  it('should prefer varsFromConfig over hostname and domain', () => {
    const vars = generateAdUnitPathVariables('example.com', 'mobile', {
      domain: 'sub.example.com',
      device: 'desktop'
    });
    expect(vars.domain).to.be.equals('sub.example.com');
    expect(vars.device).to.be.equals('desktop');
  });

  it('should prefer domainFromConfig over extracted domain', () => {
    const vars = generateAdUnitPathVariables('example.com', 'mobile', undefined, 'sub.example.com');
    expect(vars.domain).to.be.equals('sub.example.com');
    expect(vars.device).to.be.equals('mobile');
  });

  it('should prefer varsFromConfig over domainFromConfig ', () => {
    const vars = generateAdUnitPathVariables(
      'example.com',
      'mobile',
      {
        domain: 'sub.example.com',
        device: 'desktop'
      },
      'another.example.com'
    );
    expect(vars.domain).to.be.equals('sub.example.com');
    expect(vars.device).to.be.equals('desktop');
  });
});
