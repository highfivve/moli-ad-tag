/**
 * # Blocklist URLs
 *
 * This module adds `configureStep` or `prepareRequestAds` steps to the ad pipeline in order to prevent ad requests entirely
 * or a set a configurable key-value, which can be used in the ad server to handle blocklisted urls
 *
 * ## Integration
 *
 * In your `index.ts` import the blocklist-urls module and register it.
 *
 * The configuration has multiple parameters
 *
 * - `mode` - this describes what the module does if a blocklisted url is detected
 *   - `key-value` - sets a specific key-value on the googletag
 *   - `block` - rejects the pipeline step which leads to no ads being loaded
 * - `blocklist` - this config object contains the blocklist configuration
 *   - `provider` - select how the blocklist is being loaded
 *     - `static` - inline configuration inside the ad tag
 *     - `dynamic` - loads an external json file
 *
 *
 * ### Blocklist format
 *
 * A blocklist contains a list of blocklist entries stored in the `urls` property. A `IBlocklistEntry` has two
 * properties.
 *
 * - `pattern` - a string that is evaluated depending on the `matchType`
 * - `matchType`
 *   - `exact` - the url must match the pattern string
 *   - `contains` - the url must contain the given pattern string
 *   - `regex` - the url tests positive against the pattern regex string
 *
 * ### Examples
 *
 *
 * ```javascript
 * import { BlocklistedUrls } from '@highfivve/module-blocklist-url';
 *
 * moli.registerModule(new BlocklistedUrls({
 *   mode: 'block',
 *   blocklist: {
 *     provider: 'static',
 *     blocklist: {
 *       urls: [
 *         // a specific path
 *         { pattern: '\/path\/that\/should\/be\/blocklisted', matchType: 'regex' },
 *         // all http sites
 *         { pattern: '^http:\/\/.*', matchType: 'regex' },
 *         // contains a bad word
 *         { pattern: '/tag/badword', matchType: 'contains' },
 *         // exact url
 *         { pattern: 'https://www.example.com/login', matchType: 'exact' }
 *       ]
 *     }
 *   }
 * }, window));
 * ```
 *
 * You can combine `block` and `key-value` mode by adding the module twice.
 *
 * ```javascript
 * import { BlocklistedUrls } from '@highfivve/module-blocklist-url';
 *
 * moli.registerModule(new BlocklistedUrls({
 *   mode: 'block',
 *   blocklist: {
 *     provider: 'static',
 *     blocklist: {
 *       urls: [
 *         { pattern: '\/login$' },
 *         { pattern: '\/register$' },
 *       ]
 *     }
 *   }
 * }, window));
 *
 * moli.registerModule(new BlocklistedUrls({
 *   mode: 'key-value',
 *   blocklist: {
 *     provider: 'static',
 *     blocklist: {
 *       urls: [
 *         // a specific path
 *         { pattern: '\/path\/that\/should\/be\/blocklisted' },
 *         // all http sites
 *         { pattern: '^http:\/\/.*' }
 *       ]
 *     }
 *   }
 * }, window));
 * ```
 *
 * @module
 */
import {
  IModule,
  ModuleType,
  googletag,
  IAssetLoaderService,
  HIGH_PRIORITY,
  mkConfigureStep,
  mkPrepareRequestAdsStep,
  getLogger,
  MoliRuntime
} from '@highfivve/ad-tag';

export type BlocklistEntry = {
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
};

export type Blocklist = {
  readonly urls: BlocklistEntry[];
};

/**
 * A fixed set of blocklisted urls. Requires an ad tag update if new entries should be added
 */
export type StaticBlocklistProvider = {
  readonly provider: 'static';

  readonly blocklist: Blocklist;
};

/**
 * The dynamic configuration provider that lets you update entries without updating the ad tag
 */
export type DynamicBlocklistProvider = {
  readonly provider: 'dynamic';

  /**
   * Fetch the blocklist json from the specified endpoint
   */
  readonly endpoint: string;
};

export type BlocklistProvider = StaticBlocklistProvider | DynamicBlocklistProvider;

export type BlocklistUrlsBlockingConfig = {
  /**
   * `block` - this mode blocks ad requests entirely
   * `key-value` - sets a specified key value
   */
  readonly mode: 'block';

  /**
   * blocklist content
   */
  readonly blocklist: BlocklistProvider;
};

export type BlocklistUrlsKeyValueConfig = {
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
};

export type BlocklistUrlsConfig = BlocklistUrlsBlockingConfig | BlocklistUrlsKeyValueConfig;

/**
 * ## Blocklisted URLs Module
 */
export class BlocklistedUrls implements IModule {
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

  init(config: MoliRuntime.MoliConfig, assetLoaderService: IAssetLoaderService): void {
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

  isBlocklisted = (blocklist: Blocklist, href: string, log: MoliRuntime.MoliLogger): boolean => {
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
    log: MoliRuntime.MoliLogger
  ): () => Promise<Blocklist> {
    switch (blocklist.provider) {
      case 'static':
        return () => Promise.resolve(blocklist.blocklist);
      case 'dynamic':
        let cachedResult: Promise<Blocklist>;
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
  ): Promise<Blocklist> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    return assetLoaderService.loadJson<Blocklist>('blocklist-urls.json', endpoint).catch(error => {
      // for 3 retries the backoff time will be 33ms / 50ms / 100ms
      const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
      return exponentialBackoff.then(() =>
        this.loadConfigWithRetry(assetLoaderService, endpoint, retriesLeft - 1, error)
      );
    });
  }
}
