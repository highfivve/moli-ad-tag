import type { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { headerbidding } from 'ad-tag/types/moliConfig';
import IUserSyncConfig = prebidjs.userSync.IUserSyncConfig;

type UID = {
  id: string;
  atype: number;
  ext: {
    stype: string;
  };
};

/**
 * ## Criteo FPD Enrichment
 * Enrich bidder configs with criteo-specific FPD user-targeting info
 * @param runtimeConfig contains runtime information about the user
 * @param userSyncConfig the user sync config (contains info about which user ids are enabled)
 * @param source the domain
 * @param bidderConfigs the array of bidder configs to enrich
 */
export const criteoEnrichWithFpd =
  (
    runtimeConfig: MoliRuntime.MoliRuntimeConfig,
    userSyncConfig: IUserSyncConfig | undefined,
    source: string
  ) =>
  (bidderConfigs: headerbidding.SetBidderConfig[]): headerbidding.SetBidderConfig[] => {
    // don't add criteo fpd if criteo user sync is not enabled
    const criteoEnabled = userSyncConfig?.userIds?.find(uid => uid.name === 'criteo') !== undefined;
    if (!criteoEnabled) {
      return bidderConfigs;
    }

    // enrich bidderConfigs with criteo fpd if criteo is enabled
    const uids: UID[] = [];
    if (runtimeConfig.audience?.hem?.sha256 !== undefined) {
      uids.push({
        id: runtimeConfig.audience.hem.sha256,
        atype: 3,
        ext: { stype: 'hemsha256' }
      });
    }
    if (runtimeConfig.audience?.hem?.sha256ofMD5 !== undefined) {
      uids.push({
        id: runtimeConfig.audience.hem.sha256ofMD5,
        atype: 3,
        ext: { stype: 'hemsha256md5' }
      });
    }
    if (uids.length === 0) {
      return [
        ...bidderConfigs,
        {
          options: {
            bidders: ['criteo'],
            config: {}
          },
          merge: true
        }
      ];
    }

    return [
      ...bidderConfigs,
      {
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
      }
    ];
  };
