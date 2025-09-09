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
import { IModule } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import {
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  mkInitStep,
  PrepareRequestAdsStep
} from '../../adPipeline';
import { googletag } from 'ad-tag/types/googletag';
import { modules } from 'ad-tag/types/moliConfig';

const matches =
  (href: string, log: MoliRuntime.MoliLogger) =>
  (entry: { pattern: string; matchType: 'exact' | 'contains' | 'regex' }): boolean => {
    switch (entry.matchType) {
      case 'exact':
        return href === entry.pattern;
      case 'contains':
        return href.indexOf(entry.pattern) > -1;
      case 'regex':
        try {
          return RegExp(entry.pattern).test(href);
        } catch (e) {
          log.error(`Invalid regex pattern: ${entry.pattern}`, e);
          return false;
        }
      default:
        return false;
    }
  };

export const isBlocklisted = (
  blocklist: modules.blocklist.Blocklist,
  href: string,
  log: MoliRuntime.MoliLogger
): boolean => blocklist.urls.some(matches(href, log));
/**
 * ## Blocklisted URLs Module
 */
export const createBlocklistedUrls = (): IModule => {
  let blocklistConfig:
    | modules.blocklist.BlocklistUrlsBlockingConfig
    | modules.blocklist.BlocklistUrlsKeyValueConfig
    | null = null;
  let blocklistCache: Promise<modules.blocklist.Blocklist> | null = null;

  const config__ = (): Object | null => blocklistConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.blocklist && moduleConfig.blocklist.enabled) {
      blocklistConfig = moduleConfig.blocklist;
    }
  };

  const getBlocklist = (
    blocklist: modules.blocklist.BlocklistProvider,
    assetLoaderService: IAssetLoaderService,
    log: MoliRuntime.MoliLogger
  ): (() => Promise<modules.blocklist.Blocklist>) => {
    switch (blocklist.provider) {
      case 'static':
        return () => Promise.resolve(blocklist.blocklist);
      case 'dynamic':
        // not sure if this promise caching is acutally needed, because the loadConfigWithRetry
        // method already caches the result
        let cachedResult: Promise<modules.blocklist.Blocklist>;
        return () => {
          if (!cachedResult) {
            cachedResult = loadConfigWithRetry(assetLoaderService, blocklist.endpoint, 3).catch(
              e => {
                log.error('Blocklist URLs', 'Fetching blocklisted urls failed', e);
                return { urls: [] };
              }
            );
          }
          return cachedResult;
        };
    }
  };

  const loadConfigWithRetry = (
    assetLoaderService: IAssetLoaderService,
    endpoint: string,
    retriesLeft: number,
    lastError: any | null = null
  ): Promise<modules.blocklist.Blocklist> => {
    if (retriesLeft <= 0) {
      return Promise.reject(lastError);
    }
    if (!blocklistCache) {
      blocklistCache = assetLoaderService
        .loadJson<modules.blocklist.Blocklist>('blocklist-urls.json', endpoint)
        .catch(error => {
          const exponentialBackoff = new Promise(resolve => setTimeout(resolve, 100 / retriesLeft));
          return exponentialBackoff.then(() =>
            loadConfigWithRetry(assetLoaderService, endpoint, retriesLeft - 1, error)
          );
        });
    }
    return blocklistCache;
  };

  const initSteps__ = (): InitStep[] => {
    return blocklistConfig
      ? [
          mkInitStep('blocklist-urls-init', ctx => {
            switch (blocklistConfig?.mode) {
              case 'key-value':
                const key = blocklistConfig.key;
                const value = blocklistConfig.isBlocklistedValue || 'true';
                return getBlocklist(
                  blocklistConfig.blocklist,
                  ctx.assetLoaderService__,
                  ctx.logger__
                )().then(blocklist => {
                  if (isBlocklisted(blocklist, ctx.window__.location.href, ctx.logger__)) {
                    (ctx.window__ as Window & googletag.IGoogleTagWindow).googletag
                      .pubads()
                      .setTargeting(key, value);
                  }
                });
              case 'block':
                return getBlocklist(
                  blocklistConfig.blocklist,
                  ctx.assetLoaderService__,
                  ctx.logger__
                )().then(blocklist => {
                  ctx.logger__.debug('Blocklist URLs', 'using blocklist', blocklist);
                  if (isBlocklisted(blocklist, ctx.window__.location.href, ctx.logger__)) {
                    return Promise.reject('blocklisted url found. Abort ad pipeline run');
                  }
                });
              default:
                return Promise.resolve();
            }
          })
        ]
      : [];
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = blocklistConfig;
    return config
      ? [
          mkConfigureStep('blocklist-labels', async ctx => {
            const loadedBlocklist = await getBlocklist(
              config.blocklist,
              ctx.assetLoaderService__,
              ctx.logger__
            )();
            const matcher = matches(ctx.window__.location.href, ctx.logger__);
            loadedBlocklist.labels?.forEach(entry => {
              const result = entry.reverseMatch === true ? !matcher(entry) : matcher(entry);
              if (result) {
                ctx.labelConfigService__.addLabel(entry.label);
              }
            });
          })
        ]
      : [];
  };
  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name: 'Blocklist URLs',
    description: '', // remove descriptions everywhere in the future as they are not used
    moduleType: 'policy',
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};
