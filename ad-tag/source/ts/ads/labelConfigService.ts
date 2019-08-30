import { Moli } from '../types/moli';
import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';

import LabelSizeConfigEntry = Moli.LabelSizeConfigEntry;

/**
 * Conditionally select the ad unit based on labels.
 * Labels are supplied by the sizeConfig object in the top level moli configuration.
 *
 * This type relies on structural typing. All interfaces that provide the three fields
 * `labelAny`, `labelAll` and `sizes` can be filtered.
 *
 * The API and behaviour matches the prebid API.
 * - [Configure-Responsive-Ads](https://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-Responsive-Ads)
 * - [Conditional Ad Units](https://prebid.org/dev-docs/conditional-ad-units.html)
 * - [Size Mapping](https://prebid.org/dev-docs/examples/size-mapping.html)
 */
export interface ILabelledSlot {

  /** at least one label must match */
  readonly labelAny?: string[];
  /** all labels must match */
  readonly labelAll?: string[];

}

/**
 * Service that holds the labels configuration.
 *
 * It provides methods for evaluating if a given slot matches the configured criteria.
 */
export class LabelConfigService {
  private readonly supportedLabels: string[];
  /**
   * True:  Either no label config is used or the label config produced supported labels.
   * False: label config produced no supported labels thus all slots should be filtered.
   */
  private readonly isValid: boolean;

  constructor(private readonly labelSizeConfig: LabelSizeConfigEntry[],
              private readonly extraLabels: string[],
              private readonly window: Window) {
    // Matches the given slot sizes against the window's dimensions.
    const supportedLabelSizeConfigs = labelSizeConfig
      .filter(conf => window.matchMedia(conf.mediaQuery).matches);

    this.isValid = (labelSizeConfig.length === 0 || !(labelSizeConfig.length > 0 && supportedLabelSizeConfigs.length === 0));

    const supportedLabels = flatten(
      supportedLabelSizeConfigs.map(conf => conf.labelsSupported )
    );

    this.supportedLabels = [ ...supportedLabels, ...extraLabels ]
      .filter(uniquePrimitiveFilter);
  }

  /**
   * Checks if the given slot fulfills the configured slot label matching criteria.
   *
   * Labels are matched in this order: labelAll, labelAny. If both are specified, only labelAll will be
   * taken into account.
   *
   * If no labels have been configured, all labels are considered matching. See the implementation in prebid.js:
   * https://github.com/prebid/Prebid.js/blob/master/src/sizeMapping.js#L96
   *
   * @param slot the ad slot to check
   * @returns {boolean} is this slot supported (label)?
   */
  public filterSlot(slot: ILabelledSlot): boolean {
    let labelsMatching = true;

    // filtering by labels is only done if any labels were configured.
    if (this.supportedLabels.length > 0 && slot.labelAll && slot.labelAll.length > 0) {
      labelsMatching = slot.labelAll.every(label => this.supportedLabels.indexOf(label) > -1);
    }

    // if labelAll was already evaluated, labelAny will be ignored.
    if (this.supportedLabels.length > 0 && slot.labelAny && !(slot.labelAll && slot.labelAll.length > 0)) {
      labelsMatching = slot.labelAny.some(label => this.supportedLabels.indexOf(label) > -1);
    }

    return labelsMatching;
  }

  /**
   * @returns the configured supported labels
   */
  public getSupportedLabels(): string[] {
    return this.supportedLabels;
  }

}
