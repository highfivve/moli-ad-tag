import { expect } from 'chai';
import { extractDomainFromHostname } from './extractDomainFromHostname';

describe('extractDomainFromHostname', () => {
  it('should cut off the subdomain like www. in the hostname', () => {
    const hostname = 'www.testdomain.de';
    expect(extractDomainFromHostname(hostname)).to.equal('testdomain.de');
  });
  it('should allow hyphens in the domain', () => {
    const hostname = 'www.unsere-testdomain.de';
    expect(extractDomainFromHostname(hostname)).to.equal('unsere-testdomain.de');
  });
  it('should always only return the apex domain (e.g. abc.de) no matter what is in front', () => {
    const hostname = 'https://www.staging.testdomain.de';
    expect(extractDomainFromHostname(hostname)).to.equal('testdomain.de');
  });
  it('should return undefined if the hostname is undefined', () => {
    const hostname = undefined;
    expect(extractDomainFromHostname(hostname)).to.equal(undefined);
  });
  it('should return the hostname as it is if there is no subdomain', () => {
    const hostname = 'testdomain.de';
    expect(extractDomainFromHostname(hostname)).to.equal(hostname);
  });
  it('should return the hostname as it is if there is no top level domain', () => {
    const hostname = 'localhost';
    expect(extractDomainFromHostname(hostname)).to.equal(hostname);
  });
  it('should remove ALL subdomains from the hostname', () => {
    const hostname = 'foo.bar.www.testdomain.de';
    expect(extractDomainFromHostname(hostname)).to.equal('testdomain.de');
  });
});
