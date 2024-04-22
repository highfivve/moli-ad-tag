import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { BiddersDisablingConfig } from './auctions/biddersDisabling';
import IPrebidJs = prebidjs.IPrebidJs;

export class GlobalAuctionContext {
  readonly biddersDisablingConfig: BiddersDisablingConfig | undefined;
  constructor(
    private readonly window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow,
    private readonly config: Moli.auction.GlobalAuctionContextConfig = {
      biddersDisabling: {
        enabled: false,
        minRate: 0,
        minBidRequests: 0,
        deactivationTTL: 0
      }
    }
  ) {
    if (config.biddersDisabling?.enabled) {
      this.biddersDisablingConfig = new BiddersDisablingConfig(
        config.biddersDisabling.enabled,
        config.biddersDisabling.minBidRequests,
        config.biddersDisabling.minRate,
        config.biddersDisabling.deactivationTTL,
        this.window
      );
    }

    window.pbjs =
      window.pbjs ||
      ({
        que: []
      } as unknown as IPrebidJs);

    // Register events, if enabled
    if (this.config.biddersDisabling?.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('auctionEnd', auctions => {
          auctions.forEach(auction => this.handleAuctionEndEvent(auction));
        });
      });
    }
  }

  private handleAuctionEndEvent(auction: any) {
    this.biddersDisablingConfig?.onAuctionEnd(auction);
  }
}
