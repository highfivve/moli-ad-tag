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
import { IModule, ModuleType } from 'ad-tag/types/module';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

const name = 'geoedge';
const geoEdgeGvlId = '845';

declare global {
  /**
   * Extension to the Window interface to include GeoEdge configuration
   */
  interface Window {
    grumi: {
      key: string;
      cfg?: modules.geoedge.GeoEdgeConfig;
    };
  }
}

/**
 * ## GeoEdge Ad Fraud Protection
 *
 * GeoEdge blocks malicious ads.
 *
 */
export const geoEdge = (): IModule => {
  let geoEdgeConfig: modules.geoedge.GeoEdgeModuleConfig | null = null;

  const loadGeoEdge = (
    context: AdPipelineContext,
    config: modules.geoedge.GeoEdgeModuleConfig
  ): Promise<void> => {
    // test environment doesn't require geoedge
    if (context.env__ === 'test') {
      return Promise.resolve();
    }

    // no consent if gdpr applies
    if (
      context.tcData__.gdprApplies &&
      // this is only a safeguard to block geoedge
      (!context.tcData__.purpose.consents['1'] ||
        // validate the GVL ID if configured
        !context.tcData__.vendor.consents[geoEdgeGvlId])
    ) {
      context.logger__.warn(name, 'no gdpr consent, geoedge will not be loaded');
      return Promise.resolve();
    }
    context.window__.grumi = {
      key: config.key,
      cfg: config.cfg
    };
    context.assetLoaderService__
      .loadScript({
        name: name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://rumcdn.geoedge.be/${config.key}/grumi-ip.js`
      })
      .catch(error => context.logger__.error('failed to load geoedge', error));
    return Promise.resolve();
  };

  return {
    name: name,
    description: 'ad fraud detection and protection module',
    moduleType: 'ad-fraud',
    config__: () => null,
    configure__: (moduleConfig?: modules.ModulesConfig) => {
      if (moduleConfig?.geoedge && moduleConfig.geoedge.enabled) {
        geoEdgeConfig = moduleConfig.geoedge;
      }
    },
    initSteps__: () => {
      const config = geoEdgeConfig;
      return config ? [mkInitStep('geoedge-init', ctx => loadGeoEdge(ctx, config))] : [];
    },
    configureSteps__: () => [],
    prepareRequestAdsSteps__: () => []
  };
};
