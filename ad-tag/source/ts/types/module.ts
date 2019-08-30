import { Moli } from './moli';

export type ModuleType = 'cmp' | 'reporting' | 'ad-fraud' | 'prebid';

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
   *
   * @param config
   */
  init(config: Moli.MoliConfig): void;
}
