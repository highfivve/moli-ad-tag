import { Moli } from '../types/moli';

export class GlobalAuctionContext {
  readonly enabled: boolean;
  constructor(
    private readonly config: Moli.auction.GlobalAuctionContextConfig = { enabled: false }
  ) {
    this.enabled = this.config.enabled;
  }
}
