import { Moli } from '../types/moli';
import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';

import DfpSlotSize = Moli.DfpSlotSize;
import SizeConfigEntry = Moli.SizeConfigEntry;

/**
 * Filter sizes of an ad slot depending on media queries.
 */
export interface ISizedSlot {
  /**
   * The supported sizes by this slot.
   *
   * 1. If undefined this means that the slot size isn't considered for filtering.
   * 2. If the slot size is defined the sizeConfigService will use its own supported
   *    to filter the slot as well
   *
   */
  readonly sizes?: DfpSlotSize[];
}

/**
 * Service that holds the slot size configuration.
 *
 * It provides methods for evaluating if a given slot or a given set of slot sizes match the configured criteria.
 */
export class SizeConfigService {
  private readonly supportedSizes: DfpSlotSize[];

  /**
   * True:  Either no size config is used or the size config produced supported sizes.
   * False: Size config produced no supported sizes thus all sizes should be filtered.
   */
  private readonly isValid: boolean;

  public static isFixedSize(size: Moli.DfpSlotSize): size is [number, number] {
    return size !== 'fluid';
  }

  constructor(private readonly sizeConfig: SizeConfigEntry[], private readonly window: Window) {
    // Matches the given slot sizes against the window's dimensions.
    const supportedSizeConfigs =
      sizeConfig.length !== 0
        ? sizeConfig.filter(conf => window.matchMedia(conf.mediaQuery).matches)
        : [];

    this.isValid =
      sizeConfig.length === 0 || !(sizeConfig.length > 0 && supportedSizeConfigs.length === 0);

    // To filter out duplicate slot sizes, the slot size tuples are converted to strings that can be easily compared
    // using indexOf(), and back to tuples after the filtering took place.
    this.supportedSizes = flatten(supportedSizeConfigs.map(conf => conf.sizesSupported))
      .map(size => JSON.stringify(size))
      .filter(uniquePrimitiveFilter)
      .map(sizeAsString => JSON.parse(sizeAsString));
  }

  /**
   * Checks if the given slot fulfills the configured slot size matching criteria.
   *
   * @param slot the ad slot to check
   * @returns {boolean} is this slot supported (sizes)?
   */
  public filterSlot(slot: ISizedSlot): boolean {
    // for
    //  - out-of-page slots
    //  - prebid slots
    // no sizes are provided. Therefore, we need to bypass slot size filtering for these slots.
    return (
      !slot.sizes || slot.sizes.length === 0 || this.filterSupportedSizes(slot.sizes).length > 0
    );
  }

  /**
   * Returns all sizes matching the configured possible slot sizes from a given set.
   *
   * If *no* supportedSizes are present, all sizes are valid. This implementation logic is en par with prebid.js:
   * https://github.com/prebid/Prebid.js/blob/master/src/sizeMapping.js#L129-L131
   *
   * @param givenSizes
   * @returns {DfpSlotSize[]}
   */
  public filterSupportedSizes = (givenSizes: DfpSlotSize[]): DfpSlotSize[] => {
    if (!this.isValid) {
      return [];
    }
    return this.supportedSizes.length === 0
      ? givenSizes
      : this.supportedSizes.filter(configuredSize =>
          givenSizes.some(givenSize => {
            if (configuredSize === 'fluid') {
              return givenSize === 'fluid';
            } else if (givenSize === 'fluid') {
              return false;
            } else {
              return givenSize[0] === configuredSize[0] && givenSize[1] === configuredSize[1];
            }
          })
        );
  };
}
