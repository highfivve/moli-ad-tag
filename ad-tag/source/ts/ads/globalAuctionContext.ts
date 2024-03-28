import { Moli } from '../types/moli';

export class GlobalAuctionContext {
  readonly enabled: boolean;
  constructor(
    private readonly config: Moli.auction.GlobalAuctionContextConfig = { enabled: true }
  ) {
    this.enabled = this.config.enabled;
  }
}
