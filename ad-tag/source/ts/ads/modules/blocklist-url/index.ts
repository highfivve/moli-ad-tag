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
import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { ConfigureStep, InitStep, mkInitStep, PrepareRequestAdsStep } from '../../adPipeline';
import { googletag } from 'ad-tag/types/googletag';
import { modules } from 'ad-tag/types/moliConfig';

/**
 * ## Blocklisted URLs Module
 */
export class BlocklistedUrls implements IModule {
  public readonly name: string = 'Blocklist URLs';
  public readonly description: string =
    'Blocks ad requests entirely or adds key-values for blocklistd urls';
  public readonly moduleType: ModuleType = 'policy';
  private blocklistConfig:
    | modules.blocklist.BlocklistUrlsBlockingConfig
    | modules.blocklist.BlocklistUrlsKeyValueConfig
    | null = null;

  config(): Object | null {
    return this.blocklistConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.blocklist && moduleConfig.blocklist.enabled) {
      this.blocklistConfig = moduleConfig.blocklist;
    }
  }

  initSteps(): InitStep[] {
    const config = this.blocklistConfig;
    return config
      ? [
          mkInitStep('blocklist-urls-init', ctx => {
            switch (this.blocklistConfig?.mode) {
              case 'key-value':
                const key = this.blocklistConfig.key;
                const value = this.blocklistConfig.isBlocklistedValue || 'true';
                return this.getBlocklist(
                  this.blocklistConfig.blocklist,
                  ctx.assetLoaderService,
                  ctx.logger
                )().then(blocklist => {
                  if (this.isBlocklisted(blocklist, ctx.window.location.href, ctx.logger)) {
                    (ctx.window as Window & googletag.IGoogleTagWindow).googletag
                      .pubads()
                      .setTargeting(key, value);
                  }
                });
              case 'block':
                return this.getBlocklist(
                  this.blocklistConfig.blocklist,
                  ctx.assetLoaderService,
                  ctx.logger
                )().then(blocklist => {
                  ctx.logger.debug(this.name, 'using blocklist', blocklist);
                  if (this.isBlocklisted(blocklist, ctx.window.location.href, ctx.logger)) {
                    return Promise.reject('blocklisted url found. Abort ad pipeline run');
                  }
                });
              default:
                return Promise.resolve();
            }
          })
        ]
      : [];
  }

  isBlocklisted = (
    blocklist: modules.blocklist.Blocklist,
    href: string,
    log: MoliRuntime.MoliLogger
  ): boolean => {
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
            return false;
          }
      }
    });
  };

  private getBlocklist(
    blocklist: modules.blocklist.BlocklistProvider,
    assetLoaderService: IAssetLoaderService,
    log: MoliRuntime.MoliLogger
  ): () => Promise<modules.blocklist.Blocklist> {
    switch (blocklist.provider) {
      case 'static':
        return () => Promise.resolve(blocklist.blocklist);
      case 'dynamic':
        let cachedResult: Promise<modules.blocklist.Blocklist>;
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
  private blocklistCache: Promise<modules.blocklist.Blocklist> | null = null;

  private loadConfigWithRetry(
    assetLoaderService: IAssetLoaderService,
    endpoint: string,
    retriesLeft: number,
    lastError: any | null = null
  ): Promise<modules.blocklist.Blocklist> {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }

    // for three retries the backoff time will be 100ms, 200ms, 300ms
    if (!this.blocklistCache) {
      this.blocklistCache = assetLoaderService
        .loadJson<modules.blocklist.Blocklist>('blocklist-urls.json', endpoint)
        .catch(error => {
          const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
          return exponentialBackoff.then(() =>
            this.loadConfigWithRetry(assetLoaderService, endpoint, retriesLeft - 1, error)
          );
        });
    }

    return this.blocklistCache;
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }
}
