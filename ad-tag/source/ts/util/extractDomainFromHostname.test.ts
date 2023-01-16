import { expect } from 'chai';
import { extractDomainFromHostname } from './extractDomainFromHostname';

describe('extractDomainFromHostname', () => {
  it('should cut off subdomains like www. in the hostname', () => {
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
  it('should return undefined if there is no top-level domain in the hostname', () => {
    const hostname = 'www.unsere-testpage';
    expect(extractDomainFromHostname(hostname)).to.equal(undefined);
  });
});
