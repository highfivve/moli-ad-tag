import { Moli } from '../types/moli';
import { flatten } from '../util/flatten';

import DfpSlotSize = Moli.DfpSlotSize;
import SizeConfigEntry = Moli.SizeConfigEntry;
import MoliLogger = Moli.MoliLogger;
import IAdSlot = Moli.IAdSlot;

/**
 * Service that holds the slot size and labels configuration.
 *
 * It provides methods for evaluating if a given slot or a given set of slot sizes match the configured criteria.
 */
export class SizeConfigService {
  private readonly supportedSizes: DfpSlotSize[];

  constructor(sizeConfig: SizeConfigEntry[], private logger: MoliLogger) {
    // Matches the given slot sizes against the window's dimensions.
    // To filter out duplicate slot sizes, the slot size tuples are converted to strings that can be easily compared
    // with indexOf(), and back to tuples after the filtering took place.
    this.supportedSizes = flatten(sizeConfig
      .filter(conf => window.matchMedia(conf.mediaQuery).matches)
      .map(conf => conf.sizesSupported))
      .map(size => JSON.stringify(size))
      .filter((size, position, arr) => arr.indexOf(size) === position)
      .map(sizeAsString => JSON.parse(sizeAsString));
  }

  /**
   * Checks if the given slot fulfills the configured slot size and label matching criteria.
   *
   * @param slot
   * @returns {boolean} is this slot supported (label/sizes)?
   *
   * TODO: filter for labels
   */
  public filterSlot(slot: IAdSlot): boolean {
    return this.filterSupportedSizes(slot.sizes).length > 0;
  }

  /**
   * Returns all sizes matching the configured possible slot sizes from a given set.
   *
   * @param givenSizes
   * @returns {DfpSlotSize[]}
   */
  public filterSupportedSizes(givenSizes: DfpSlotSize[]): DfpSlotSize[] {
    if (this.supportedSizes.length === 0) {
      this.logger.warn('SizeConfig: not properly initialized (supported sizes empty)');
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
