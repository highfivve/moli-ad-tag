import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { BiddersDisabling } from './auctions/biddersDisabling';
import { AdRequestThrottling } from './auctions/adRequestThrottling';

/**
 * ## Global Auction Context
 *
 * This class wires up the external event systems to the internal state machines that provide additional features
 * around the auctions that happen on the device. This includes features like
 *
 * - Bidders Disabling
 * - Ad Request Throttling
 *
 * ## Note for implementors
 *
 * This class does not contain any state itself, but only sets up event listeners and wires up the specific feature.
 * Every new feature must be enabled separately and should not share any data with other features.
 */
export class GlobalAuctionContext {
  readonly biddersDisabling?: BiddersDisabling;
  readonly adRequestThrottling?: AdRequestThrottling;

  constructor(
    private readonly window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow,
    private readonly config: Moli.auction.GlobalAuctionContextConfig = {}
  ) {
    if (config.biddersDisabling?.enabled) {
      this.biddersDisabling = new BiddersDisabling(config.biddersDisabling, this.window);
    }

    if (config.adRequestThrottling?.enabled) {
      this.adRequestThrottling = new AdRequestThrottling(config.adRequestThrottling, this.window);
    }

    // FIXME we need to make sure that pbjs.que and googletag.que are initialized globally in moli ad tag, so we don't
    //       have to put this init code across the entire codebase
    this.window.pbjs = this.window.pbjs || ({ que: [] } as unknown as prebidjs.IPrebidJs);
    this.window.googletag =
      this.window.googletag || ({ cmd: [] } as unknown as googletag.IGoogleTag);

    // Register events, if enabled
    if (this.config.biddersDisabling?.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('auctionEnd', auction => {
          this.handleAuctionEndEvent(auction);
        });
      });
    }

    if (this.config.adRequestThrottling?.enabled) {
      this.window.googletag.cmd.push(() => {
        this.window.googletag.pubads().addEventListener('slotRequested', event => {
          this.adRequestThrottling?.onSlotRequested(event);
        });
      });
    }
  }

  isSlotThrottled(slotId: string): boolean {
    return this.adRequestThrottling?.isThrottled(slotId) ?? false;
  }

  private handleAuctionEndEvent(auction: any) {
    this.biddersDisabling?.onAuctionEnd(auction);
  }
}
