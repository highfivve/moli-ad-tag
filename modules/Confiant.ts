import { confiantPrebid } from './confiant';
import { AssetLoadMethod, createAssetLoaderService } from '../source/ts/util/assetLoaderService';

interface IConfiantConfig {
  readonly gpt: IConfiantGptConfig;
}

interface IConfiantGptConfig {
  readonly propertyId: string;
  /**
   * usually `clarium.global.ssl.fastly.net`
   */
  readonly confiantCdn: string;

  /**
   * Enables sandboxing on a device group
   * All:1 , Desktop:2, Mobile: 3, iOS: 4, Android: 5, Off: 0
   */
  readonly sandbox: 0 | 1 | 2 | 3 | 4 | 5;

  /**
   * Confiant needs to map orderIds in DFP. This is probably a string representation for
   * this mapping information.
   */
  readonly mapping: string;

  /**
   * No idea what this is for, but we need it
   */
  readonly activation: string;

  /**
   * We can add reporting with this callback
   */
  readonly callback?: (blockingType: any, blockingId: any, isBlocked: Boolean, wrapperId: any, tagId: any, impressionData: any) => void;
}

interface IConfiantWindow {
  /**
   * of course the configuration is stored in a global variable
   */
  _clrm: IConfiantConfig;
}

declare const window: Window & IConfiantWindow;

/**
 * == Confiant Ad Fraud Protection ==
 *
 * Confiant blocks malicious ads
 *
 */
export default class Confiant {

  constructor(config: IConfiantConfig) {
    window._clrm = config;
    confiantPrebid();
    createAssetLoaderService(window).loadScript({
      name: 'confiant',
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: `//${config.gpt.confiantCdn}/gpt/a/wrap.js?v2_1`
    });
  }
}
