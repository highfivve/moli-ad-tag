import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { IModule, ModuleType } from '@highfivve/ad-tag/source/ts/types/module';
import { mkInitStep } from '@highfivve/ad-tag/source/ts/ads/adPipeline';
import {
  AssetLoadMethod,
  IAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';

import { initStub } from './stub';
import IPrebidJs = prebidjs.IPrebidJs;

export interface IPubstackConfig {
  readonly tagId: string;
}

type PubstackWindow = Window &
  prebidjs.IPrebidjsWindow &
  googletag.IGoogleTagWindow & {
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

  constructor(private readonly pubstackConfig: IPubstackConfig) {}

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
        initStub(ctx.window, 'Pubstack', this.pubstackConfig.tagId);

        // add prebid events
        ctx.window.pbjs = ctx.window.pbjs || (({ que: [] } as unknown) as IPrebidJs);
        ctx.window.pbjs.que.push(() => {
          ([
            'auctionInit',
            'auctionEnd',
            'bidTimeout',
            'bidRequested',
            'bidResponse',
            'bidWon',
            'noBid'
          ] as const).forEach(event =>
            ctx.window.pbjs.onEvent(event, (args: any) =>
              (ctx.window as PubstackWindow).Pubstack.cmd('prebid', event, args)
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
