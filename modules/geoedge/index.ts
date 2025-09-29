/**
 * # [GeoEdge](https://www.geoedge.com/)
 *
 * GeoEdge is an ad fraud detection and blocking solution. It supports gpt and prebid.
 *
 *
 * ## Resources
 *
 * - [GeoEdge Dashboard](https://publisher.geoedge.com)
 *
 * @module
 */

import {
  AdPipelineContext,
  AssetLoadMethod,
  IAssetLoaderService,
  IModule,
  mkInitStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

declare global {
  /**
   * Extension to the Window interface to include GeoEdge configuration
   */
  interface Window {
    grumi: {
      key: string;
      cfg?: GeoEdgeConfig;
    };
  }
}

/**
 * In case you don't want to limit the demand sources monitored, you can leave those objects empty.
 *
 * @see https://helpcenter.geoedge.com/hc/en-us/articles/360029065811-Choosing-what-to-Monitor-Include-Exclude-specific-Advertisers#overview-0-0
 */
export type GeoEdgeFilter = {
  /**
   * the key is either an advertiserId, AdSense id or `exclude`.
   */
  readonly [id: string | 'exclude']: boolean;
};

export interface GeoEdgeConfig {
  /**
   * To support any of the Prebid-compatible Header Bidding Libraries, you can set the name of
   * the module here.
   */
  readonly pbGlobal?: string;

  /**
   * Filter GAM advertiser ids. Use `exclude` as a key and set it to `true` if you want to
   * exclude advertisers instead of including them.
   *
   * In case you don't want to limit the demand sources monitored, you can leave those objects empty.
   */
  readonly advs?: GeoEdgeFilter;

  /**
   * Should be used in case you would like to monitor only AdX/AdSense connected to your Google Ad Manager account.
   * These id's need to be set under 'pubIds' (with the entire `ca-pub-xx…` string):
   *
   * In case you don't want to limit the demand sources monitored, you can leave those objects empty.
   */
  readonly pubIds?: GeoEdgeFilter;
}

export type GeoEdgeModuleConfig = {
  /**
   * Your GeoEdge publisher key
   */
  readonly key: string;

  /**
   * Optional configuration for GeoEdge.
   */
  readonly cfg?: GeoEdgeConfig;
};

/**
 * ## GeoEdge Ad Fraud Protection
 *
 * GeoEdge blocks malicious ads.
 *
 */
export class GeoEdge implements IModule {
  public readonly name = 'geoedge';
  public readonly description: string = 'ad fraud detection and protection module';
  public readonly moduleType: ModuleType = 'ad-fraud';

  private readonly geoEdgeGvlId = '845';

  constructor(private readonly geoEdgeConfig: GeoEdgeModuleConfig) {}

  config(): Object | null {
    return this.geoEdgeConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };
    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => this.loadGeoEdge(ctx, assetLoaderService))
    );
  }

  loadGeoEdge(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    // test environment doesn't require geoedge
    if (context.env === 'test') {
      return Promise.resolve();
    }
    // no consent if gdpr applies
    if (
      context.tcData.gdprApplies &&
      (!context.tcData.purpose.consents['1'] || !context.tcData.vendor.consents[this.geoEdgeGvlId])
    ) {
      context.logger.warn(this.name, 'no gdpr consent, geoedge will not be loaded');
      return Promise.resolve();
    }
    context.window.grumi = {
      key: this.geoEdgeConfig?.key || '',
      cfg: this.geoEdgeConfig?.cfg
    };
    assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${this.geoEdgeConfig?.key}/grumi-ip.js`
      })
      .catch(error => context.logger.error('failed to load geoedge', error));
    return Promise.resolve();
  }
}
