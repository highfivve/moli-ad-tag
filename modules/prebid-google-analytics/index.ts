import { IModule, Moli, prebidjs } from '@highfivve/ad-tag';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

export interface IPrebidGoogleAnalyticsConfig {
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
}

export default class PrebidGoogleAnalytics implements IModule {
  readonly name: string = 'Prebid Google Analytics Module';
  readonly moduleType = 'prebid';
  readonly description: string = 'Configure and enable the prebid google analytics adapter';

  constructor(
    private readonly pgaConfig: IPrebidGoogleAnalyticsConfig,
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
