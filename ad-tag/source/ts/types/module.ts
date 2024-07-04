import { IAssetLoaderService } from '../util/assetLoaderService';
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from '../ads/adPipeline';
import { modules } from './moliConfig';

export type ModuleType =
  | 'cmp'
  | 'reporting'
  | 'ad-fraud'
  | 'prebid'
  | 'ad-reload'
  | 'policy'
  | 'identity'
  | 'dmp'
  | 'yield'
  | 'creatives'
  | 'lazy-load';

export interface IModule {
  readonly name: string;
  readonly description: string;
  readonly moduleType: ModuleType;

  /**
   * If the module has some sort of configuration this can be fetched with this method
   */
  config(): Object | null;

  /**
   * Initialize the module with the given module configuration.
   * Depending on the configuration the module may become active or inactive.
   *
   * @param moduleConfig
   */
  configure(moduleConfig?: modules.ModulesConfig): void;

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  initSteps(): InitStep[];

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  configureSteps(): ConfigureStep[];

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  prepareRequestAdsSteps(): PrepareRequestAdsStep[];
}

export type ModuleMeta = Pick<IModule, 'name' | 'description' | 'moduleType'> & {
  config: Object | null;
};
