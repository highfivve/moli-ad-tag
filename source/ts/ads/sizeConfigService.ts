import { Moli } from '../types/moli';
import { flatten } from '../util/flatten';

import DfpSlotSize = Moli.DfpSlotSize;
import IAdSlot = Moli.IAdSlot;
import MoliLogger = Moli.MoliLogger;

export class SizeConfigService {
  private slots: Array<IAdSlot> = [];

  constructor(private logger: MoliLogger) {}

  public initialize(slots: Array<IAdSlot>): void {
    this.slots = slots;
  }

  public filterSupportedSizes(givenSizes: Array<DfpSlotSize>): Array<DfpSlotSize> {
    if (this.slots.length === 0) {
      this.logger.warn('SizeConfig: not initialized (slots empty)');
    }

    return flatten(this.slots.map(slot => slot.sizes)).filter(
      configuredSize => givenSizes.some(
        givenSize => {
          if (configuredSize === 'fluid') {
            return givenSize === 'fluid';
          } else if (givenSize === 'fluid') {
            return false;
          } else {
            return givenSize[0] === configuredSize[0] && givenSize[1] === configuredSize[1];
          }
        }
      )
    );
  }
}
