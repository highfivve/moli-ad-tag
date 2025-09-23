import type { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { headerbidding } from 'ad-tag/types/moliConfig';
import SetBidderConfig = headerbidding.SetBidderConfig;

type UID = {
  id: string;
  atype: number;
  ext: {
    stype: string;
  };
};

export const criteoEnrichWithFpd = (
  runtimeConfig: MoliRuntime.MoliRuntimeConfig,
  source: string
): SetBidderConfig => {
  const uids: UID[] = [];
  if (runtimeConfig.audience?.hem?.sha256 !== undefined) {
    uids.push({
      id: runtimeConfig.audience.hem.sha256,
      atype: 3,
      ext: {
        stype: 'hemsha256'
      }
    });
  }
  if (runtimeConfig.audience?.hem?.sha256ofMD5 !== undefined) {
    uids.push({
      id: runtimeConfig.audience.hem.sha256ofMD5,
      atype: 1,
      ext: {
        stype: 'hemsha256md5'
      }
    });
  }
  if (uids.length === 0) {
    return {
      options: {
        bidders: ['criteo'],
        config: {}
      },
      merge: true
    };
  }

  return {
    options: {
      bidders: ['criteo'],
      config: {
        ortb2: {
          user: {
            ext: {
              data: {
                eids: [
                  {
                    source: source,
                    uids: uids
                  }
                ]
              }
            }
          }
        }
      }
    },
    merge: true
  };
};
