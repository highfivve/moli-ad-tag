import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';

import { emptyRuntimeConfig } from '../stubs/moliStubs';
import { id5Config } from './id5';
import { MoliRuntime } from '../types/moliRuntime';
import { prebidjs } from '../types/prebidjs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('id5', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe('id5Config', () => {
    const mockUserSyncWithId5: prebidjs.userSync.IUserSyncConfig = {
      userIds: [
        {
          name: 'id5Id',
          storage: {
            type: 'html5',
            name: 'id5id',
            expires: 90,
            refreshInSeconds: 8 * 3600
          },
          params: {
            partner: 1519
          }
        }
      ]
    };

    const mockUserSyncWithoutId5: prebidjs.userSync.IUserSyncConfig = {
      userIds: [
        {
          name: 'sharedId',
          storage: {
            type: 'html5',
            name: 'sharedId',
            expires: 123
          },
          params: { create: true, pixelUrl: '/ads/sharedId' }
        }
      ]
    };

    const runtimeConfigWithSha256Hem: MoliRuntime.MoliRuntimeConfig = {
      ...emptyRuntimeConfig,
      audience: {
        hem: {
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
      }
    };

    const id5ProviderConfigWithPd: prebidjs.userSync.IID5Provider = {
      name: 'id5Id',
      storage: {
        type: 'html5',
        name: 'id5id',
        expires: 90,
        refreshInSeconds: 8 * 3600
      },
      params: {
        partner: 1519,
        pd: btoa(`1=${encodeURIComponent(runtimeConfigWithSha256Hem.audience!.hem!.sha256!)}`)
      }
    };

    const id5ProviderConfigWithoutPd: prebidjs.userSync.IID5Provider = {
      name: 'id5Id',
      storage: {
        type: 'html5',
        name: 'id5id',
        expires: 90,
        refreshInSeconds: 8 * 3600
      },
      params: {
        partner: 1519
      }
    };

    /** Unhappy path scenarios: Return null if userSync config is missing or doesn't contain ID5 */

    it('should return null if userSync is undefined', () => {
      const result = id5Config(emptyRuntimeConfig, undefined);
      expect(result).to.be.null;
    });

    it('should return null if id5Id userId provider is not enabled', () => {
      const result = id5Config(emptyRuntimeConfig, mockUserSyncWithoutId5);
      expect(result).to.be.null;
    });

    it('should return null if userSync.userIds is undefined', () => {
      const userSyncWithoutUserIds: prebidjs.userSync.IUserSyncConfig = {};
      const result = id5Config(emptyRuntimeConfig, userSyncWithoutUserIds);
      expect(result).to.be.null;
    });

    /** Happy path scenarios: id5 is enabled, HEM can be provided or not */

    it('should return id5 config with pd if SHA256 email is provided', () => {
      const result = id5Config(runtimeConfigWithSha256Hem, mockUserSyncWithId5);

      expect(result).to.not.be.null;
      expect(result!).to.be.deep.equal(id5ProviderConfigWithPd);
    });

    it('should find id5Id provider when multiple providers are configured', () => {
      const userSyncWithMultipleProviders: prebidjs.userSync.IUserSyncConfig = {
        userIds: [
          {
            name: 'sharedId',
            storage: {
              type: 'html5',
              name: 'sharedId',
              expires: 123
            },
            params: { create: true, pixelUrl: '/ads/sharedId' }
          },
          id5ProviderConfigWithoutPd
        ]
      };

      const result = id5Config(runtimeConfigWithSha256Hem, userSyncWithMultipleProviders);

      expect(result).to.not.be.null;
      expect(result!.name).to.equal('id5Id');
      expect(result!).to.be.deep.equal(id5ProviderConfigWithPd);
    });

    it('should create base64 encoded pd with SHA256 email', () => {
      const result = id5Config(runtimeConfigWithSha256Hem, mockUserSyncWithId5);

      expect(result).to.not.be.null;
      expect(result!.params.pd).to.be.a('string');

      // Decode the base64 pd and verify it contains the email
      const decodedPd = atob(result!.params.pd!);
      const sha256Email = runtimeConfigWithSha256Hem.audience?.hem?.sha256!;
      expect(decodedPd).to.include(`1=${encodeURIComponent(sha256Email)}`);
    });

    it('should return id5 config without pd if no email is provided', () => {
      const result = id5Config(emptyRuntimeConfig, mockUserSyncWithId5);

      expect(result).to.deep.equal(id5ProviderConfigWithoutPd);
    });
  });
});
