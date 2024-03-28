import { IModule, ModuleType, Moli } from '@highfivve/ad-tag';
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

export class Cleanup implements IModule {
  public readonly name: string = 'cleanup';
  public readonly description: string = 'cleanup out-of-page formats for navigation or ad-reload';
  public readonly moduleType: ModuleType = 'creatives';

  private log?: Moli.MoliLogger;

  constructor(private readonly cleanupModuleConfig: CleanupModuleConfig) {}

  config(): Object | null {
    return this.cleanupModuleConfig;
  }

  init() {}
}
