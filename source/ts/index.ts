import { AdInventoryProvider } from './ads/adInventoryProvider';
import { DfpService } from './ads/dfpService';
import { adPerformanceService } from './ads/adPerformanceService';
import { IAdNetworkService } from './ads/IAdNetworkService';
import { AdService } from './ads/adService';
import { assetLoaderService } from './util/assetLoaderService';
import { cookieService } from './util/cookieService';
import { prebidjs } from './types/prebidjs';
import { googletag } from './types/googletag';

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

declare const window: Window & IGlobalGoogleTagApi & prebidjs.IGlobalPrebidJsApi;

/*
 * Init ads:
 *  - ad inventory
 *  - ad network services (DoubleClick for Publishers (DFP))
 *  - ad service
 */
const adInventoryProvider = new AdInventoryProvider(frontendConfig.appConfig.adConfiguration, globalLogger);
const dfpService = new DfpService(
  window.googletag,
  window.pbjs,
  adPerformanceService,
  services.base.trackService, // TODO
  assetLoaderService,
  cookieService,
  cmpService, // TODO
  globalLogger // TODO
);

// TODO
// Initialize adSlot <-> application communication via `postMessage` messages
window.addEventListener('message', messageEventListener(window.location.origin, adInventoryProvider));

const adServices: IAdNetworkService[] = [ dfpService ];
const adService = new AdService(
  adServices,
  adInventoryProvider,
  performanceMeasurementService, // TODO
  frontendConfig.appConfig.vertical, // TODO
  globalLogger // TODO
);

adService.initialize();
