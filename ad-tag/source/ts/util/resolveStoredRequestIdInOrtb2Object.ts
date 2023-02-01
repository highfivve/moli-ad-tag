import { prebidjs } from '../types/prebidjs';
/**
 * Helper function to exchange the unresolved storedrequest id (incl. adUnitPathVariables) with the resolved id.
 *
 * @param unresolvedOrtb2 the ortb2 object with the unresolved storedrequest id.
 * @param storedRequestWithSolvedId the storedrequest object with the resolved storedrequest id.
 *
 * @return ortb2 object with the resolved storedrequest id
 */

export const resolveStoredRequestIdInOrtb2Object = (
  unresolvedOrtb2: prebidjs.IOrtb2Imp,
  storedRequestWithSolvedId: { id: string }
): prebidjs.IOrtb2Imp => {
  return {
    ...unresolvedOrtb2,
    ext: {
      ...unresolvedOrtb2.ext,
      prebid: {
        ...unresolvedOrtb2.ext?.prebid,
        storedrequest: storedRequestWithSolvedId
      }
    }
  };
};
