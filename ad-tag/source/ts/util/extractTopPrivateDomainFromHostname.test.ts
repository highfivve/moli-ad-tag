import { expect } from 'chai';
import { extractTopPrivateDomainFromHostname } from './extractTopPrivateDomainFromHostname';

describe('extractDomainFromHostname', () => {
  it('should cut off the subdomain like www. in the hostname', () => {
    const hostname = 'www.testdomain.de';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal('testdomain.de');
  });
  it('should allow hyphens in the domain', () => {
    const hostname = 'www.unsere-testdomain.de';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal('unsere-testdomain.de');
  });
  it('should always only return the apex domain (e.g. abc.de) no matter what is in front', () => {
    const hostname = 'https://www.staging.testdomain.de';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal('testdomain.de');
  });
  it('should return undefined if the hostname is undefined', () => {
    const hostname = undefined;
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal(undefined);
  });
  it('should return the hostname as it is if there is no subdomain', () => {
    const hostname = 'testdomain.de';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal(hostname);
  });
  it('should return the hostname as it is if there is no top level domain', () => {
    const hostname = 'localhost';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal(hostname);
  });
  it('should remove ALL subdomains from the hostname', () => {
    const hostname = 'foo.bar.www.testdomain.de';
    expect(extractTopPrivateDomainFromHostname(hostname)).to.equal('testdomain.de');
  });

  describe('ccTLD - country code top level domains', () => {
    ['co.uk', 'com.br'].forEach(ccTld => {
      it(`should work for ${ccTld} domains without subdomains`, () => {
        const hostname = `testdomain.${ccTld}`;
        expect(extractTopPrivateDomainFromHostname(hostname)).to.equal(`testdomain.${ccTld}`);
      });
      it(`should work for ${ccTld} domains with subdomain`, () => {
        const hostname = `foo.bar.www.testdomain.${ccTld}`;
        expect(extractTopPrivateDomainFromHostname(hostname)).to.equal(`testdomain.${ccTld}`);
      });
    });
  });
});
