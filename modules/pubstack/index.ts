import {
  Moli,
  IModule,
  ModuleType,
  mkInitStep,
  AssetLoadMethod,
  IAssetLoaderService
} from '@highfivve/ad-tag';

import { initStub } from './stub';

export interface IPubstackConfig {
  readonly tagId: string;
}

type PubstackWindow = {
  /**
   * pubstack que
   */
  readonly Pubstack: {
    cmd(cmd: 'prebid', event: string, args: any): void;
  };
};

/**
 * == Pubstack Analytics ==
 *
 * Provides analytics for prebid, adx and hopefully more.
 *
 * @see https://pubstack.io
 */
export default class Pubstack implements IModule {
  public readonly name: string = 'pubstack';
  public readonly description: string = 'prebid analytics integration';
  public readonly moduleType: ModuleType = 'reporting';

  private readonly pubstackWindow: PubstackWindow;

  constructor(private readonly pubstackConfig: IPubstackConfig, private readonly window: Window) {
    this.pubstackWindow = (window as unknown) as PubstackWindow;
  }

  config(): Object | null {
    return this.pubstackConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep('pubstack', ctx => {
        // initialize command que for pubstack
        initStub(this.window, 'Pubstack', this.pubstackConfig.tagId);

        // add prebid events
        window.pbjs = window.pbjs || { que: [] };
        window.pbjs.que.push(() => {
          ([
            'auctionInit',
            'auctionEnd',
            'bidTimeout',
            'bidRequested',
            'bidResponse',
            'bidWon',
            'noBid'
          ] as const).forEach(event =>
            window.pbjs.onEvent(event, (args: any) =>
              this.pubstackWindow.Pubstack.cmd('prebid', event, args)
            )
          );
        });

        // load the pubstack script
        assetLoaderService.loadScript({
          name: 'pubstack',
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: `https://boot.pbstck.com/v1/tag/${this.pubstackConfig.tagId}`
        });
        return Promise.resolve();
      })
    );
  }
}
