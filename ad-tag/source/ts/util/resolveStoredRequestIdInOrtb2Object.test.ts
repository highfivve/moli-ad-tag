import { expect } from 'chai';
import { resolveStoredRequestIdInOrtb2Object } from './resolveStoredRequestIdInOrtb2Object';

describe('resolveStoredRequestIdInOrtb2Object', () => {
  it('should keep all keys on first level', () => {
    const ortb2Object = {
      anotherKey: { key: 'value' },
      ext: {
        prebid: {
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/{device}/{domain}`
          }
        }
      }
    };
    const storedRequestWithSolvedId = {
      id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
    };
    const expected = {
      anotherKey: { key: 'value' },
      ext: {
        prebid: {
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
          }
        }
      }
    };

    expect(
      resolveStoredRequestIdInOrtb2Object(ortb2Object, storedRequestWithSolvedId)
    ).to.deep.equal(expected);
  });
  it('should keep all keys on second level', () => {
    const ortb2Object = {
      ext: {
        anotherKey: { key: 'value' },
        prebid: {
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/{device}/{domain}`
          }
        }
      }
    };
    const storedRequestWithSolvedId = {
      id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
    };
    const expected = {
      ext: {
        anotherKey: { key: 'value' },
        prebid: {
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
          }
        }
      }
    };

    expect(
      resolveStoredRequestIdInOrtb2Object(ortb2Object, storedRequestWithSolvedId)
    ).to.deep.equal(expected);
  });
  it('should keep all keys on third level', () => {
    const ortb2Object = {
      ext: {
        prebid: {
          anotherKey: { key: 'value' },
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/{device}/{domain}`
          }
        }
      }
    };
    const storedRequestWithSolvedId = {
      id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
    };
    const expected = {
      ext: {
        prebid: {
          anotherKey: { key: 'value' },
          storedrequest: {
            id: `/55155651/prebid_test/ad-content-1/mobile/testdomain`
          }
        }
      }
    };

    expect(
      resolveStoredRequestIdInOrtb2Object(ortb2Object, storedRequestWithSolvedId)
    ).to.deep.equal(expected);
  });
});
