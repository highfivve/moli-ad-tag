import { Moli } from './moli';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { AdPipeline } from '../../..';

export type ModuleType = 'cmp' | 'reporting' | 'ad-fraud' | 'prebid' | 'ad-reload' | 'policy';

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
   * @param config
   * @param assetLoaderService
   * @param adPipeline
   */
  init(
    config: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    adPipeline: AdPipeline
  ): void;
}
