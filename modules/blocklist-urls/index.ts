import {
  IModule,
  ModuleType,
  googletag,
  IAssetLoaderService,
  HIGH_PRIORITY,
  mkConfigureStep,
  mkPrepareRequestAdsStep,
  getLogger,
  Moli
} from '@highfivve/ad-tag';

export interface IBlocklistEntry {
  /**
   * A regex pattern for the complete href of the page
   */
  readonly pattern: string;

  /**
   * Defines how the pattern should be matched against the url
   *
   * - `regex` - transform the pattern into a regex and runs `regex.test(url)`
   * - `contains` - checks if the url contains the given pattern string
   * - `exact` - checks if the url exactly matches the given pattern string
   */
  readonly matchType: 'regex' | 'contains' | 'exact';
}

export interface IBlocklist {
  readonly urls: IBlocklistEntry[];
}

/**
 * A fixed set of blocklisted urls. Requires an ad tag update if new entries should be added
 */
export interface IStaticBlocklistProvider {
  readonly provider: 'static';

  readonly blocklist: IBlocklist;
}

/**
 * The dynamic configuration provider that lets you update entries without updating the ad tag
 */
export interface IDynamicBlocklistProvider {
  readonly provider: 'dynamic';

  /**
   * Fetch the blocklist json from the specified endpoint
   */
  readonly endpoint: string;
}

export type BlocklistProvider = IStaticBlocklistProvider | IDynamicBlocklistProvider;

export interface IBlocklistUrlsBlockingConfig {
  /**
   * `block` - this mode blocks ad requests entirely
   * `key-value` - sets a specified key value
   */
  readonly mode: 'block';

  /**
   * blocklist content
   */
  readonly blocklist: BlocklistProvider;
}

export interface IBlocklistUrlsKeyValueConfig {
  /**
   * `block` - this mode blocks ad requests entirely
   * `key-value` - sets a specified key value
   */
  readonly mode: 'key-value';

  readonly blocklist: BlocklistProvider;

  /**
   * The key that is used for the key value
   */
  readonly key: string;

  /**
   * The value that is sent when a URL is listed.
   *
   * default is `true`
   */
  readonly isBlocklistedValue?: string;
}

export type BlocklistUrlsConfig = IBlocklistUrlsBlockingConfig | IBlocklistUrlsKeyValueConfig;

export default class BlocklistedUrls implements IModule {
  public readonly name: string = 'Blocklist URLs';
  public readonly description: string =
    'Blocks ad requests entirely or adds key-values for blocklistd urls';
  public readonly moduleType: ModuleType = 'policy';

  constructor(
    private readonly blocklistUrlsConfig: BlocklistUrlsConfig,
    private readonly window: Window
  ) {}

  config(): Object | null {
    return this.blocklistUrlsConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);

    if (config.environment === 'test') {
      log.debug(this.name, 'ad tag in test mode. Blocklist module is disabled');
      return;
    }

    log.debug(this.name, 'Initialize module with config', this.blocklistUrlsConfig);

    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const fetchBlocklist = this.getBlocklist(
      this.blocklistUrlsConfig.blocklist,
      assetLoaderService,
      log
    );

    switch (this.blocklistUrlsConfig.mode) {
      case 'key-value':
        const key = this.blocklistUrlsConfig.key;
        const value = this.blocklistUrlsConfig.isBlocklistedValue || 'true';
        config.pipeline.prepareRequestAdsSteps.push(
          mkPrepareRequestAdsStep('blocklist-urls', HIGH_PRIORITY, () => {
            return fetchBlocklist().then(blocklist => {
              log.debug(this.name, 'using blocklist', blocklist);
              if (this.isBlocklisted(blocklist, this.window.location.href, log)) {
                (this.window as Window & googletag.IGoogleTagWindow).googletag
                  .pubads()
                  .setTargeting(key, value);
              }
            });
          })
        );
        return;
      case 'block':
        config.pipeline.configureSteps.push(
          mkConfigureStep('blocklist-urls', () => {
            return fetchBlocklist().then(blocklist => {
              log.debug(this.name, 'using blocklist', blocklist);
              if (this.isBlocklisted(blocklist, this.window.location.href, log)) {
                return Promise.reject('blocklisted url found. Abort ad pipeline run');
              }
            });
          })
        );
        return;
    }
  }

  isBlocklisted = (blocklist: IBlocklist, href: string, log: Moli.MoliLogger): boolean => {
    return blocklist.urls.some(({ pattern, matchType }) => {
      switch (matchType) {
        case 'exact':
          return href === pattern;
        case 'contains':
          return href.indexOf(pattern) > -1;
        case 'regex':
          try {
            const matched = RegExp(pattern).test(href);
            if (matched) {
              log.debug(this.name, `Url '${href}' matched pattern '${pattern}'`);
            }
            return matched;
          } catch (e) {
            log.error(this.name, `Invalid pattern ${pattern}`, e);
            console.log(this.name, `Invalid pattern ${pattern}`, e);
            return false;
          }
      }
    });
  };

  private getBlocklist(
    blocklist: BlocklistProvider,
    assetLoaderService: IAssetLoaderService,
    log: Moli.MoliLogger
  ): () => Promise<IBlocklist> {
    switch (blocklist.provider) {
      case 'static':
        return () => Promise.resolve(blocklist.blocklist);
      case 'dynamic':
        let cachedResult: Promise<IBlocklist>;
        return () => {
          if (!cachedResult) {
            cachedResult = this.loadConfigWithRetry(
              assetLoaderService,
              blocklist.endpoint,
              3
            ).catch(e => {
              log.error(this.name, 'Fetching blocklisted urls failed', e);
              // fallback to no urls
              return { urls: [] };
            });
          }
          return cachedResult;
        };
    }
  }

  private loadConfigWithRetry(
    assetLoaderService: IAssetLoaderService,
    endpoint: string,
    retriesLeft: number,
    lastError: any | null = null
  ): Promise<IBlocklist> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    return assetLoaderService.loadJson<IBlocklist>('blocklist-urls.json', endpoint).catch(error => {
      // for 3 retries the backoff time will be 33ms / 50ms / 100ms
      const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
      return exponentialBackoff.then(() =>
        this.loadConfigWithRetry(assetLoaderService, endpoint, retriesLeft - 1, error)
      );
    });
  }
}
