import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';
import { isSizeEqual } from '../util/sizes';

import { googleAdManager, sizeConfigs } from '../types/moliConfig';

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
  readonly sizes?: googleAdManager.SlotSize[];
}

/**
 * Service that holds the slot size configuration.
 *
 * It provides methods for evaluating if a given slot or a given set of slot sizes match the configured criteria.
 */
export class SizeConfigService {
  private readonly supportedSizes: googleAdManager.SlotSize[];

  /**
   * True:  Either no size config is used or the size config produced supported sizes.
   * False: Size config produced no supported sizes thus all sizes should be filtered.
   */
  private readonly isValid: boolean;

  public static isFixedSize(size: googleAdManager.SlotSize): size is [number, number] {
    return size !== 'fluid';
  }

  constructor(
    private readonly sizeConfig: sizeConfigs.SizeConfigEntry[],
    private readonly supportedLabels: string[],
    private readonly window: Window
  ) {
    // Matches the given slot sizes against the window's dimensions.
    const supportedSizeConfigs =
      sizeConfig.length !== 0
        ? sizeConfig.filter(
            conf =>
              // media query must match
              window.matchMedia(conf.mediaQuery).matches &&
              // if labelAll is defined, all labels must be part of the supportedLabels array
              this.areLabelsMatching(conf, supportedLabels)
          )
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
   * @returns {googleAdManager.SlotSize[]}
   */
  public filterSupportedSizes = (
    givenSizes: googleAdManager.SlotSize[]
  ): googleAdManager.SlotSize[] => {
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
              return isSizeEqual(givenSize, configuredSize);
            }
          })
        );
  };

  private areLabelsMatching = (
    conf: sizeConfigs.SizeConfigEntry,
    supportedLabels: string[]
  ): boolean => {
    return (
      // either labelAll is not set or _all_ labels must be present
      (!conf.labelAll ||
        conf.labelAll.every(label =>
          supportedLabels.some(supportedLabel => supportedLabel === label)
        )) &&
      // and either labelNone is not set or none of should be present
      (!conf.labelNone ||
        // false as soon as one of the supported labels is part of the labelNone set
        !conf.labelNone.some(label =>
          supportedLabels.some(supportedLabel => supportedLabel === label)
        ))
    );
  };
}
