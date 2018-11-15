import { Moli } from '../types/moli';
import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';

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
  private readonly supportedLabels: string[];

  constructor(sizeConfig: SizeConfigEntry[], private logger: MoliLogger) {
    // Matches the given slot sizes against the window's dimensions.
    const supportedConfigs = sizeConfig
      .filter(conf => window.matchMedia(conf.mediaQuery).matches);

    if (sizeConfig.length > 0 && supportedConfigs.length === 0) {
      this.logger.debug('SizeConfig: supported sizes empty after matchMedia filtering - probably wrong config?');
    }

    // To filter out duplicate slot sizes, the slot size tuples are converted to strings that can be easily compared
    // using indexOf(), and back to tuples after the filtering took place.
    this.supportedSizes = flatten(
      supportedConfigs
        .map(conf => conf.sizesSupported)
    )
      .map(size => JSON.stringify(size))
      .filter(uniquePrimitiveFilter)
      .map(sizeAsString => JSON.parse(sizeAsString));

    this.supportedLabels = flatten(
      supportedConfigs
        .map(conf => conf.labels)
    )
      .filter(uniquePrimitiveFilter);
  }

  /**
   * Checks if the given slot fulfills the configured slot size and label matching criteria.
   *
   * Labels are matched in this order: labelAll, labelAny. If both are specified, only labelAll will be
   * taken into account.
   *
   * If no labels have been configured, all labels are considered matching. See the implementation in prebid.js:
   * https://github.com/prebid/Prebid.js/blob/master/src/sizeMapping.js#L96
   *
   * @param slot the ad slot to check
   * @returns {boolean} is this slot supported (label/sizes)?
   */
  public filterSlot(slot: IAdSlot): boolean {
    let labelsMatching = true;

    // filtering by labels is only done if any labels were configured.
    if (this.supportedLabels.length > 0 && slot.labelAll) {
      labelsMatching = slot.labelAll.every(label => this.supportedLabels.indexOf(label) > -1);
    }

    // if labelAll was already evaluated, labelAny will be ignored.
    if (this.supportedLabels.length > 0 && slot.labelAny && !slot.labelAll) {
      labelsMatching = slot.labelAny.some(label => this.supportedLabels.indexOf(label) > -1);
    }

    return labelsMatching && this.filterSupportedSizes(slot.sizes).length > 0;
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
  public filterSupportedSizes(givenSizes: DfpSlotSize[]): DfpSlotSize[] {
    return this.supportedSizes.length === 0 ? givenSizes : this.supportedSizes.filter(
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
