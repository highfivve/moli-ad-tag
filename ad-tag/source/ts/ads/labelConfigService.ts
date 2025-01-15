import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';
import { Device, googleAdManager, MoliConfig, sizeConfigs } from '../types/moliConfig';
import { MoliRuntime } from '../types/moliRuntime';

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

  /**
   * List of possible devices that can be configured.
   * This list is used to check if any of the configured labels by the publisher contains
   * a device label. If no device label is found, we use the label based on the labelSizeConfig.
   */
  private readonly possibleDevices: Device[] = ['mobile', 'desktop', 'android', 'ios'];

  constructor(
    private readonly labelSizeConfig: sizeConfigs.LabelSizeConfigEntry[],
    private readonly extraLabels: string[],
    private readonly window: Window
  ) {
    // Check if the device label is already defined by the publisher
    const isPublisherDeviceDefined: boolean = extraLabels.some(
      (label): label is Device => this.possibleDevices.indexOf(<Device>label) > -1
    );

    // Matches the given slot sizes against the window's dimensions.
    const supportedLabelSizeConfigs = labelSizeConfig.filter(
      conf => window.matchMedia(conf.mediaQuery).matches
    );

    this.isValid =
      labelSizeConfig.length === 0 ||
      !(labelSizeConfig.length > 0 && supportedLabelSizeConfigs.length === 0);

    const supportedLabels = flatten(supportedLabelSizeConfigs.map(conf => conf.labelsSupported));

    // Use labels from labelSizeConfig when no publisher defined device label was found.
    this.supportedLabels = [
      ...(isPublisherDeviceDefined ? [] : supportedLabels),
      ...extraLabels
    ].filter(uniquePrimitiveFilter);
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
    if (this.supportedLabels.length && slot.labelAll?.length) {
      labelsMatching = slot.labelAll.every(label => this.supportedLabels.indexOf(label) > -1);
    }

    // if labelAll was already evaluated, labelAny will be ignored.
    if (this.supportedLabels.length && slot.labelAny && !slot.labelAll?.length) {
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

  /**
   * @returns the currently configured device. If no device label is found, mobile is being returned
   */
  public getDeviceLabel(): Device {
    return (
      this.getSupportedLabels().find(
        (label): label is Device => this.possibleDevices.indexOf(<Device>label) > -1
      ) || 'mobile'
    );
  }
}

/**
 * A small helper function to get the device label from a fresh LabelService instance.
 *
 * @param window used for the media query matching
 * @param targeting access static labels from the config
 * @param runtimeConfig access labels set during runtime (e.g. from the ad tag or the publisher)
 * @param labelSizeConfig configuration from the server side config
 */
export const getDeviceLabel = (
  window: Window,
  runtimeConfig: MoliRuntime.MoliRuntimeConfig,
  labelSizeConfig: sizeConfigs.LabelSizeConfigEntry[] | undefined,
  targeting: googleAdManager.Targeting | undefined
): Device => {
  return new LabelConfigService(
    labelSizeConfig ?? [],
    [...(targeting?.labels || []), ...runtimeConfig.labels],
    window
  ).getDeviceLabel();
};
