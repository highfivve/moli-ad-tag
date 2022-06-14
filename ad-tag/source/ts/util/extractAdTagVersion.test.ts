import { extractAdTagVersion } from './extractAdTagVersion';
import { expect } from 'chai';

const releasesJsonWithNumberVersion = JSON.parse('{"currentVersion":4}');
const releasesJsonWithStringVersion = JSON.parse('{"currentVersion":"42"}');
const releasesJsonWithAnyVersion = JSON.parse('{"currentVersion":"asdf"}');
const releasesJsonWithNoVersion = JSON.parse('{}');

describe('extractAdTagVersion', () => {
  it('should be able to process a version number found in releases.json', () => {
    expect(extractAdTagVersion(releasesJsonWithNumberVersion)).to.equal('4');
  });

  it('should be able to process a version string found in releases.json', () => {
    expect(extractAdTagVersion(releasesJsonWithStringVersion)).to.equal('42');
  });

  it('should not choke on a garbage version in releases.json', () => {
    expect(extractAdTagVersion(releasesJsonWithAnyVersion)).to.be.undefined;
  });

  it('should be able to process a number found in releases.json', () => {
    expect(extractAdTagVersion(releasesJsonWithNoVersion)).to.be.undefined;
  });
});
