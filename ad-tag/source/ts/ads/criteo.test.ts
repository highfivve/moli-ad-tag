import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { criteoEnrichWithFpd } from 'ad-tag/ads/criteo';
import type { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { newEmptyRuntimeConfig } from 'ad-tag/stubs/moliStubs';
import { headerbidding } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import SetBidderConfig = headerbidding.SetBidderConfig;

use(sinonChai);
use(chaiAsPromised);

const runtimeConfigWithHems: MoliRuntime.MoliRuntimeConfig = {
  ...newEmptyRuntimeConfig(),
  audience: {
    hem: {
      sha256: 'hashed_value_1',
      sha256ofMD5: 'hashed_value_2'
    }
  }
};
const userSyncConfigWithCriteo: prebidjs.userSync.IUserSyncConfig = {
  userIds: [{ name: 'criteo' }]
};
const source = 'example.com';
const bidderConfigWithOrbidder: headerbidding.SetBidderConfig[] = [
  { options: { bidders: ['orbidder'], config: {} } }
];

describe('criteoEnrichWithFpd', () => {
  it('should enrich the criteo bidder config with Criteo FPD when Criteo user sync is enabled and HEM data is present', () => {
    const enrichedConfigs = criteoEnrichWithFpd(
      runtimeConfigWithHems,
      userSyncConfigWithCriteo,
      source
    )(bidderConfigWithOrbidder);
    expect(enrichedConfigs).to.have.lengthOf(2);
    const criteoConfig = enrichedConfigs.find((config: any) =>
      config.options.bidders.includes('criteo')
    );
    expect(criteoConfig).to.exist;
    expect(criteoConfig!.options.config.ortb2?.user?.ext.data.eids[0].source).to.equal(source);
    expect(criteoConfig!.options.config.ortb2?.user?.ext.data.eids[0].uids).to.deep.include.members(
      [
        { id: 'hashed_value_1', atype: 3, ext: { stype: 'hemsha256' } },
        { id: 'hashed_value_2', atype: 3, ext: { stype: 'hemsha256md5' } }
      ]
    );
  });
  it('should replace the criteo SetBidderConfig object with the enriched one', () => {
    const bidderConfig: SetBidderConfig[] = [
      ...bidderConfigWithOrbidder,
      { options: { bidders: ['criteo'], config: {} } }
    ];
    const enrichedConfigs = criteoEnrichWithFpd(
      runtimeConfigWithHems,
      userSyncConfigWithCriteo,
      source
    )(bidderConfig);

    expect(enrichedConfigs).to.have.lengthOf(2);
    const criteoConfig = enrichedConfigs.find((config: any) =>
      config.options.bidders.includes('criteo')
    );
    expect(criteoConfig).to.exist;
    expect(criteoConfig!.options.config.ortb2?.user?.ext.data.eids[0].source).to.equal(source);
    expect(criteoConfig!.options.config.ortb2?.user?.ext.data.eids[0].uids).to.deep.include.members(
      [
        { id: 'hashed_value_1', atype: 3, ext: { stype: 'hemsha256' } },
        { id: 'hashed_value_2', atype: 3, ext: { stype: 'hemsha256md5' } }
      ]
    );
  });
  it('should not enrich bidderConfigs when Criteo user sync is not enabled', () => {
    const userSyncConfig: prebidjs.userSync.IUserSyncConfig = { userIds: [{ name: 'taboolaId' }] };

    const enrichedConfigs = criteoEnrichWithFpd(
      runtimeConfigWithHems,
      userSyncConfig,
      source
    )(bidderConfigWithOrbidder);

    expect(enrichedConfigs).to.deep.equal(bidderConfigWithOrbidder);
  });
  it('should not enrich bidderConfigs when HEM data is not present', () => {
    const enrichedConfigs = criteoEnrichWithFpd(
      newEmptyRuntimeConfig(),
      userSyncConfigWithCriteo,
      source
    )(bidderConfigWithOrbidder);

    expect(enrichedConfigs).to.deep.equal(bidderConfigWithOrbidder);
  });
});
