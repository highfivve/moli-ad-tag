import {
  IModule,
  ModuleType,
  Moli,
  getLogger,
  IAssetLoaderService,
  mkPrepareRequestAdsStep,
  HIGH_PRIORITY, mkConfigureStep
} from '@highfivve/ad-tag';

export interface IBlacklistEntry {

  /**
   * A regex pattern for the complete href of the page
   */
  readonly pattern: string;

}

export interface IBlacklist {
  readonly urls: IBlacklistEntry[];
}

/**
 * A fixed set of blacklisted urls. Requires an ad tag update if new entries should be added
 */
export interface IStaticBlacklistProvider {
  readonly provider: 'static';

  readonly blacklist: IBlacklist;
}

/**
 * The dynamic configuration provider that lets you update entries without updating the ad tag
 */
export interface IDynamicBlacklistProvider {
  readonly provider: 'dynamic';

  /**
   * Fetch the blacklist json from the specified endpoint
   */
  readonly endpoint: string;
}

export type BlacklistProvider = IStaticBlacklistProvider | IDynamicBlacklistProvider;


export interface IBlacklistUrlsBlockingConfig {

  /**
   * `block` - this mode blocks ad requests entirely
   * `key-value` - sets a specified key value
   */
  readonly mode: 'block';

  /**
   * blacklist content
   */
  readonly blacklist: BlacklistProvider;

}

export interface IBlacklistUrlsKeyValueConfig {

  /**
   * `block` - this mode blocks ad requests entirely
   * `key-value` - sets a specified key value
   */
  readonly mode: 'key-value';

  readonly blacklist: BlacklistProvider;

  /**
   * The key that is used for the key value
   */
  readonly key: string;

  /**
   * The value that is sent when a URL is listed.
   *
   * default is `true`
   */
  readonly isBlacklistedValue?: string;

}

export type BlacklistUrlsConfig = IBlacklistUrlsBlockingConfig | IBlacklistUrlsKeyValueConfig;

export default class BlacklistedUrls implements IModule {

  public readonly name: string = 'Blacklist URLs';
  public readonly description: string = 'Blocks ad requests entirely or adds key-values for blacklistd urls';
  public readonly moduleType: ModuleType = 'policy';

  constructor(private readonly blacklistUrlsConfig: BlacklistUrlsConfig, private readonly window: Window) {
  }

  config(): Object | null {
    return this.blacklistUrlsConfig;
  }


  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);

    if (config.environment === 'test') {
      log.debug(this.name, 'ad tag in test mode. Blacklist module is disabled');
      return;
    }

    log.debug(this.name, 'Initialize module with config', this.blacklistUrlsConfig);

    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      configureSteps: [],
      prepareRequestAdsSteps: []
    };


    const fetchBlacklist = this.getBlacklist(this.blacklistUrlsConfig.blacklist, assetLoaderService, log);

    switch (this.blacklistUrlsConfig.mode) {
      case 'key-value':
        const key = this.blacklistUrlsConfig.key;
        const value = this.blacklistUrlsConfig.isBlacklistedValue || 'true';
        config.pipeline.prepareRequestAdsSteps.push(mkPrepareRequestAdsStep(
          'blacklist-urls', HIGH_PRIORITY, () => {
            return fetchBlacklist().then(blacklist => {
              log.debug(this.name, 'using blacklist', blacklist);
              if (this.isBlacklisted(blacklist, this.window.location.href, log)) {
                this.window.googletag.pubads().setTargeting(key, value);
              }
            });
          }));
        return;
      case 'block':
        config.pipeline.configureSteps.push(mkConfigureStep(
          'blacklist-urls', () => {
            return fetchBlacklist().then(blacklist => {
              log.debug(this.name, 'using blacklist', blacklist);
              if (this.isBlacklisted(blacklist, this.window.location.href, log)) {
                return Promise.reject('blacklisted url found. Abort ad pipeline run');
              }
            });
          }));
        return;
    }
  }

  private isBlacklisted = (blacklist: IBlacklist, href: string, log: Moli.MoliLogger): boolean => {
    return blacklist.urls.some(({ pattern }) => {
      try {
        const matched = RegExp(pattern).test(href);
        if (matched) {
          log.debug(this.name, `Url '${href}' matched pattern '${pattern}'`);
        }
        return matched;
      } catch (e) {
        log.error(this.name, `Invalid pattern ${pattern}`, e);
        return false;
      }
    });
  }

  private getBlacklist(blacklist: BlacklistProvider, assetLoaderService: IAssetLoaderService, log: Moli.MoliLogger): (() => Promise<IBlacklist>) {
    switch (blacklist.provider) {
      case 'static':
        return () => Promise.resolve(blacklist.blacklist);
      case 'dynamic':
        let cachedResult: Promise<IBlacklist>;
        return () => {
          if (!cachedResult) {
            cachedResult = this
              .loadConfigWithRetry(assetLoaderService, blacklist.endpoint, 3)
              .catch((e) => {
                log.error(this.name, 'Fetching blacklisted urls failed', e);
                // fallback to no urls
                return { urls: [] };
              });
          }
          return cachedResult;
        };
    }
  }

  private loadConfigWithRetry(assetLoaderService: IAssetLoaderService, endpoint: string, retriesLeft: number, lastError: any | null = null): Promise<IBlacklist> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    return assetLoaderService.loadJson<IBlacklist>('blacklist-urls.json', endpoint)
      .catch(error => {
        // for 3 retries the backoff time will be 33ms / 50ms / 100ms
        const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
        return exponentialBackoff.then(() => this.loadConfigWithRetry(assetLoaderService, endpoint, retriesLeft - 1, error));
      });

  }
}
