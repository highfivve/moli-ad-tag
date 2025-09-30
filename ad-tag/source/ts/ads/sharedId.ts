import { prebidjs } from 'ad-tag/types/prebidjs';
import IUserSyncConfig = prebidjs.userSync.IUserSyncConfig;
import ISharedIdProvider = prebidjs.userSync.ISharedIdProvider;

export const sharedIdConfig = (userSync: IUserSyncConfig | undefined): ISharedIdProvider => {
  const sharedIdProvider: ISharedIdProvider | undefined = userSync?.userIds?.find(
    id => id.name === 'sharedId'
  );
  if (sharedIdProvider !== undefined) {
    return sharedIdProvider;
  } else {
    return {
      name: 'sharedId',
      params: undefined,
      storage: {
        name: '_sharedID',
        type: 'cookie',
        expires: 30
      }
    };
  }
};
