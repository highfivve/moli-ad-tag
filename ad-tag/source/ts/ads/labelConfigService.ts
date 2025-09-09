import { flatten, uniquePrimitiveFilter } from '../util/arrayUtils';
import type { Device, googleAdManager, sizeConfigs } from '../types/moliConfig';
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
export interface LabelConfigService {
  /**
   * @param slot check the `labelAny` and `labelAll` properties of the slot against the configured labels.
   */
  filterSlot(slot: ILabelledSlot): boolean;

  /**
   * Returns all labels currently available. Sources labels can come from:
   *
   * - the sizeConfig object in the top level moli configuration
   * - the `labels` property in the runtime config
   * - `addLabel` calls during adPipeline#run calls
   */
  getSupportedLabels(): string[];
  getDeviceLabel(): Device;

  /**
   * Adds a label to the list of supported labels. This API is for pipeline steps that want to add
   * labels dynamically during the ad pipeline run.
   *
   * Note: each adPipeline run creates a new labelConfigService instance, so this method only
   *       ever alters a single ad pipeline run.
   *
   * @param label - device labels are not allowed and will be ignored.
   */
  addLabel(label: string): void;
}

const possibleDevices: Device[] = ['mobile', 'desktop', 'android', 'ios'];

export const createLabelConfigService = (
  labelSizeConfig: sizeConfigs.LabelSizeConfigEntry[],
  extraLabels: string[],
  window: Window
): LabelConfigService => {
  const isPublisherDeviceDefined: boolean = extraLabels.some(
    (label): label is Device => possibleDevices.indexOf(<Device>label) > -1
  );

  const supportedLabelSizeConfigs = labelSizeConfig.filter(
    conf => window.matchMedia(conf.mediaQuery).matches
  );

  const supportedLabels = [
    ...(isPublisherDeviceDefined
      ? []
      : flatten(supportedLabelSizeConfigs.map(conf => conf.labelsSupported))),
    ...extraLabels
  ].filter(uniquePrimitiveFilter);

  const filterSlot = (slot: ILabelledSlot): boolean => {
    let labelsMatching = true;

    if (supportedLabels.length && slot.labelAll?.length) {
      labelsMatching = slot.labelAll.every(label => supportedLabels.indexOf(label) > -1);
    }

    if (supportedLabels.length && slot.labelAny && !slot.labelAll?.length) {
      labelsMatching = slot.labelAny.some(label => supportedLabels.indexOf(label) > -1);
    }

    return labelsMatching;
  };

  const getSupportedLabels = (): string[] => {
    return supportedLabels;
  };

  const getDeviceLabel = (): Device => {
    return (
      supportedLabels.find(
        (label): label is Device => possibleDevices.indexOf(<Device>label) > -1
      ) || 'mobile'
    );
  };

  const addLabel = (label: string): void => {
    // do not allow device labels to be added
    if (!possibleDevices.includes(<Device>label)) {
      supportedLabels.push(label);
    }
  };

  return {
    filterSlot,
    getSupportedLabels,
    getDeviceLabel,
    addLabel
  };
};

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
  return createLabelConfigService(
    labelSizeConfig ?? [],
    [...(targeting?.labels || []), ...runtimeConfig.labels],
    window
  ).getDeviceLabel();
};
