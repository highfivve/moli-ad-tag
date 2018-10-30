import {DfpSlot} from './adNetworkSlot';
import {IVertical} from '../../../config/appConfig';

export interface IAdNetworkService {

  /**
   * unique, human readable networkname
   */
  readonly networkName: string;

  /**
   * Initialize ads for this ad network.
   *
   * @param slots The adSlots that could be displayed
   * @param configuration The ad network configuration
   * @param vertical The current vertical
   * @returns {Promise<void>} resolves when the ad network has finished loading. This could indicate
   * that either one or all ads are loaded.
   */
  initialize(slots: DfpSlot[], configuration: IAdNetworkConfiguration, vertical: IVertical): Promise<void>;
}

export declare class IAdNetworkConfiguration {
  readonly networkName?: string;

  readonly tags: string[];
  readonly consultation?: boolean;
  readonly isAdultContent: boolean;
  readonly marketingChannel: IMarketingChannel;
  readonly abTest: number;
}

export interface IMarketingChannel {
  readonly channel: string;
  readonly subChannel?: string;
  readonly channelGfThemaId: string;
}
