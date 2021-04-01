/**
 * # Prebid Google Analytics Module
 *
 * This module configures the prebid google analytics adapter and the necessary google analytics setup.
 *
 * ## Requirements
 *
 * The publisher loads google universal analytics.
 *
 * ## Integration
 *
 * 1. Install google analytics typings with
 *    ```bash
 *    $ yarn add --dev @types/google.analytics
 *    ```
 * 2. In your `index.ts` import and register the module.
 *    ```javascript
 *    import { PrebidGoogleAnalytics } from '@highfivve/module-prebid-google-analytics';
 *
 *    moli.registerModule(new PrebidGoogleAnalytics({
 *      trackingId: 'UA-965201-41',
 *      options: {
 *        global: 'ga', // only necessary if it's not ga
 *        trackerName: 'h5', // sets up a new tracker with this name
 *        sampling: 1, // set sampling to something appropriate
 *        enableDistribution: true // enables events for load time distribution
 *      }
 *    }, window));
 *    ```
 * 3. And finally add the `googleAnalyticsAdapter` to the prebid `modules.json`
 *
 *
 * ## Resources
 *
 * - [prebid google analytics](http://prebid.org/overview/ga-analytics.html)
 * - [google analytics for developers](https://developers.google.com/analytics/devguides/collection/analyticsjs/)
 * - [google analytic types](https://www.npmjs.com/package/@types/google.analytics)
 * - [prebid google analytics adapter js](https://github.com/prebid/Prebid.js/blob/2.33.0/modules/googleAnalyticsAdapter.js)
 * - [prebid publisher api `pbjs.enableAnalytics`](http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.enableAnalytics)
 *
 * @module
 */
import { getLogger, IModule, Moli, prebidjs, IAssetLoaderService } from '@highfivve/ad-tag';

export type PrebidGoogleAnalyticsConfig = {
  /**
   * the google analytics instance that should be used.
   *
   * E.g. 'UA-965201-41' (gutefrage.net / Highfivve Prebid)
   */
  readonly trackingId: string;

  /**
   * configuration for the prebid google analytics adapter
   */
  readonly options: prebidjs.analytics.IGoogleAnalyticsAdapterOptions;
};

/**
 * # Prebid Google Analytics Module
 */
export class PrebidGoogleAnalytics implements IModule {
  readonly name: string = 'Prebid Google Analytics Module';
  readonly moduleType = 'prebid';
  readonly description: string = 'Configure and enable the prebid google analytics adapter';

  constructor(
    private readonly pgaConfig: PrebidGoogleAnalyticsConfig,
    private readonly window: Window
  ) {}

  config(): Object | null {
    return this.pgaConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);

    // only makes sense when prebid is enabled
    if (!config.prebid) {
      log.error(this.name, "Prebid isn't configured!");
      return;
    }

    log.debug(this.name, 'configure google analytics tracker', this.pgaConfig);
    // initialize the global google analytics properties
    const gaGlobal = this.pgaConfig.options.global || 'ga';
    const trackerName = this.pgaConfig.options.trackerName || 'h5';

    // make typescript a bit happier
    const _window = this.window as any;

    // https://developers.google.com/analytics/devguides/collection/analyticsjs/
    _window[gaGlobal] =
      _window[gaGlobal] ||
      function init(): void {
        _window[gaGlobal].q = _window[gaGlobal].q || [];
        _window[gaGlobal].q.push(arguments);
      };
    _window[gaGlobal].l = +new Date();

    // https://developers.google.com/analytics/devguides/collection/analyticsjs/creating-trackers
    _window[gaGlobal]('create', this.pgaConfig.trackingId, 'auto', trackerName);
    _window[gaGlobal](`${trackerName}.send`, 'pageview');

    _window.pbjs = _window.pbjs || { que: [] };
    _window.pbjs.que.push(() => {
      log.debug(this.name, 'enabling the prebid google analytics adapter');
      // add the google analytics adapter
      _window.pbjs.enableAnalytics([
        {
          provider: 'ga',
          options: this.pgaConfig.options
        }
      ]);
    });
  }
}
