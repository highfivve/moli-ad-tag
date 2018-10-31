import { DfpService } from './ads/dfpService';
import { assetLoaderService } from './util/assetLoaderService';
import { cookieService } from './util/cookieService';
import { prebidjs } from './types/prebidjs';
import { googletag } from './types/googletag';
import { Moli } from './types/moli';

import MoliLogger = Moli.MoliLogger;
import MoliWindow = Moli.MoliWindow;

/**
 * The Global Google Tag API.
 */
interface IGlobalGoogleTagApi {
  /**
   * Google Publisher Tag (gpt.js)
   * @see {@link https://developers.google.com/doubleclick-gpt/reference}
   */
  googletag: googletag.IGoogleTag;
}

declare const window: Window & IGlobalGoogleTagApi & prebidjs.IGlobalPrebidJsApi & MoliWindow;

const globalLogger: MoliLogger = {
  debug: window.moliConfig.logger.debug || console.debug,
  info: window.moliConfig.logger.info || console.info,
  warn: window.moliConfig.logger.warn || console.warn,
  error: window.moliConfig.logger.error || console.error
};

/*
 * Init ads:
 *  - ad inventory
 *  - ad network services (DoubleClick for Publishers (DFP))
 *  - ad service
 */
const dfpService = new DfpService(
  window.googletag,
  window.pbjs,
  assetLoaderService,
  cookieService,
  globalLogger
);

dfpService.initialize(window.moliConfig.slots)
  .then(() => window.dispatchEvent(new CustomEvent('ads.loaded')));
