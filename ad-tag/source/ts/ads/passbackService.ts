import { Moli } from '../types/moli';
import { googletag } from '../types/googletag';

type IPassbackMessage = {
  type: 'passback',

  /**
   * the domId of the ad slot that should be refreshed
   */
  domId: string,

  /**
   * name of the advertisier who is the origin for the passback to being triggered
   */
  passbackOrigin: string
};

export class PassbackService {

  /**
   * We lazy initialize the window message listener and track
   * the state with this flag.
   *
   * Initialization starts when the first adSlot is added.
   */
  private isInitialized: boolean = false;

  /**
   * AdSlots that have passback support enabled
   */
  private readonly adSlots: {
    [domId: string]: Moli.SlotDefinition<Moli.AdSlot>;
  } = {};

  private readonly passbackKeyValue: string = 'passback';
  private readonly passbackOriginKeyValue: string = 'passbackOrigin';

  constructor(
    private readonly gpt: googletag.IGoogleTag,
    private readonly logger: Moli.MoliLogger,
    private readonly window: Window
  ) {
  }

  addAdSlot(adSlot: Moli.SlotDefinition<Moli.AdSlot>): void {
    // initialize on the first add call
    if (!this.isInitialized) {
      this.isInitialized = true;
      this.initMessageListener();
    }

    this.adSlots[adSlot.moliSlot.domId] = adSlot;
  }

  private initMessageListener(): void {
    this.logger.debug('Passback Service', 'Add message listener');
    this.window.addEventListener('message', (event: MessageEvent) => {
      // avoid infinite loops by not allowing to send message to one self
      const message = this.parseMessageData(event.data);
      if (!message) {
        return;
      }

      this.logger.debug('Passback Service', 'Received passback message', message);

      const adSlot = this.adSlots[message.domId];
      if (adSlot) {
        this.logger.debug('Passback Service', 'Process passback for ad slot');
        adSlot.adSlot.setTargeting(this.passbackKeyValue, 'true');
        adSlot.adSlot.setTargeting(this.passbackOriginKeyValue, message.passbackOrigin);
        this.gpt.pubads().refresh([ adSlot.adSlot ], { changeCorrelator: false });
        
        // allow passback only once
        delete this.adSlots[message.domId];
      }
    });
  }

  private parseMessageData(data: any): IPassbackMessage | null {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        if (message.type === 'passback' && message.domId && message.passbackOrigin) {
          return message;
        }
        // if this is not a valid message we return null
        return null;
      } catch (err) {
        // invalid json - another iframe message was posted
        return null;
      }
    }
    // only handle string data
    return null;
  }
}
