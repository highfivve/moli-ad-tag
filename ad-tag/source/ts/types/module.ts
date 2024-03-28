import { Moli } from './moli';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { AdPipeline } from '../ads/adPipeline';

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
   * Initialize the module. This method is allowed to do the following things
   *
   * - request external resources. The rest of the application won't wait until this is finished
   * - alter the config in place
   * - set values in global scope
   * - use the ad pipeline to execute moli commands
   *
   * **Important**: If you want to access any elements in the DOM you must do this
   *                in an ad pipeline step as the DOM may not be ready, when the
   *                `init` method is called!
   *
   * @param config
   * @param assetLoaderService
   * @param getAdPipeline this method returns the current ad pipeline. When you
   *                      call it in the `init` method, it will return an empty
   *                      pipeline as the ad tag is not yet initialized.
   */
  init(
    config: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ): void;
}

export type ModuleMeta = Pick<IModule, 'name' | 'description' | 'moduleType'> & {
  config: Object | null;
};

/**
 * @returns a copy of the module, containing meta data like module name, type, description, and config, without access
 *          to its methods.
 */
export const metaFromModule = (module: IModule): ModuleMeta => ({
  moduleType: module.moduleType,
  name: module.name,
  description: module.description,
  config: module.config()
});

export interface CSSHidingConfig {
  readonly cssSelectors: string[];
}

export interface JSHidingConfig {
  readonly jsAsString: string;
}

export interface CleanupConfig {
  readonly bidder: string;
  readonly deleteMethod: CSSHidingConfig | JSHidingConfig;
}

export type CleanupModuleConfig = {
  /**
   * A list of configurations.
   */
  readonly configs: CleanupConfig[];
};
