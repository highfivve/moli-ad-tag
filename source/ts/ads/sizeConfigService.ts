import { Moli } from '../types/moli';
import { flatten } from '../util/flatten';

import DfpSlotSize = Moli.DfpSlotSize;
import SizeConfigEntry = Moli.SizeConfigEntry;
import MoliLogger = Moli.MoliLogger;

export class SizeConfigService {
  private supportedSizes: DfpSlotSize[];

  constructor(sizeConfig: SizeConfigEntry[], private logger: MoliLogger) {
    this.supportedSizes = flatten(sizeConfig
      .filter(conf => window.matchMedia(conf.mediaQuery).matches)
      .map(conf => conf.sizesSupported))
      .map(size => JSON.stringify(size))
      .filter((size, position, arr) => arr.indexOf(size) === position)
      .map(sizeAsString => JSON.parse(sizeAsString));
  }

  public filterSupportedSizes(givenSizes: DfpSlotSize[]): DfpSlotSize[] {
    if (this.supportedSizes.length === 0) {
      this.logger.warn('SizeConfig: not initialized (supported sizes empty)');
    }

    return this.supportedSizes.filter(
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
