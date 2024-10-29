import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { BiddersDisabling } from './auctions/biddersDisabling';
import { AdRequestThrottling } from './auctions/adRequestThrottling';
import { auction } from '../types/moliConfig';
import { FrequencyCapping } from './auctions/frequencyCapping';
import { PreviousBidCpms } from './auctions/previousBidCpms';

/**
 * ## Global Auction Context
 *
 * This class wires up the external event systems to the internal state machines that provide additional features
 * around the auctions that happen on the device. This includes features like
 *
 * - Bidders Disabling
 * - Ad Request Throttling
 * - Frequency Capping
 *
 * ## Note for implementors
 *
 * This class does not contain any state itself, but only sets up event listeners and wires up the specific feature.
 * Every new feature must be enabled separately and should not share any data with other features.
 */
export class GlobalAuctionContext {
  readonly biddersDisabling?: BiddersDisabling;
  readonly adRequestThrottling?: AdRequestThrottling;
  readonly frequencyCapping?: FrequencyCapping;
  readonly previousBidCpms?: PreviousBidCpms;

  constructor(
    private readonly window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow,
    private readonly config: auction.GlobalAuctionContextConfig = {}
  ) {
    if (config.biddersDisabling?.enabled) {
      this.biddersDisabling = new BiddersDisabling(config.biddersDisabling, this.window);
    }

    if (config.adRequestThrottling?.enabled) {
      this.adRequestThrottling = new AdRequestThrottling(config.adRequestThrottling, this.window);
    }

    if (config.frequencyCap?.enabled) {
      this.frequencyCapping = new FrequencyCapping(config.frequencyCap, this.window);
    }

    if (config.previousBidCpms?.enabled) {
      this.previousBidCpms = new PreviousBidCpms();
    }

    // FIXME we need to make sure that pbjs.que and googletag.que are initialized globally in moli ad tag, so we don't
    //       have to put this init code across the entire codebase
    this.window.pbjs = this.window.pbjs || ({ que: [] } as unknown as prebidjs.IPrebidJs);
    this.window.googletag =
      this.window.googletag || ({ cmd: [] } as unknown as googletag.IGoogleTag);

    // Register events, if enabled
    if (this.config.biddersDisabling?.enabled || this.config.previousBidCpms?.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('auctionEnd', auction => {
          if (this.config.biddersDisabling?.enabled) {
            this.handleAuctionEndEvent(auction);
          }
          if (this.config.previousBidCpms?.enabled && auction.bidsReceived) {
            this.previousBidCpms?.onAuctionEnd(auction.bidsReceived);
          }
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

    if (this.config.frequencyCap?.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('bidWon', bid => {
          if (this.config.frequencyCap) {
            this.frequencyCapping?.onBidWon(bid, this.config.frequencyCap.configs);
          }
        });
      });
    }
  }

  isSlotThrottled(slotId: string): boolean {
    return this.adRequestThrottling?.isThrottled(slotId) ?? false;
  }

  isBidderFrequencyCappedOnSlot(slotId: string, bidder: prebidjs.BidderCode): boolean {
    return this.frequencyCapping?.isFrequencyCapped(slotId, bidder) ?? false;
  }

  getLastBidCpmsOfAdUnit(slotId: string): number[] {
    return this.previousBidCpms?.getLastBidCpms(slotId) ?? [];
  }

  private handleAuctionEndEvent(auction: any) {
    this.biddersDisabling?.onAuctionEnd(auction);
  }
}
