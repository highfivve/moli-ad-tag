import { AdInventoryProvider } from './ads/adInventoryProvider';
import { DfpService } from './ads/dfpService';
import { adPerformanceService } from './ads/adPerformanceService';
import { IAdNetworkService } from './ads/IAdNetworkService';
import { AdService } from './ads/adService';

/*
 * Init ads:
 *  - ad inventory
 *  - ad network services (DoubleClick for Publishers (DFP), InteractiveMedia (IM))
 *  - ad service
 */
const adInventoryProvider = new AdInventoryProvider(frontendConfig.appConfig.adConfiguration, globalLogger);
const dfpService = new DfpService(
  window.googletag,
  window.pbjs,
  queryService,
  adPerformanceService,
  services.base.trackService,
  assetLoaderService,
  cookieService,
  cmpService,
  globalLogger
);

// Initialize adSlot <-> application communication via `postMessage` messages
window.addEventListener('message', messageEventListener(window.location.origin, adInventoryProvider));

const adServices: IAdNetworkService[] = [dfpService];
const adService = new AdService(
  adServices,
  adInventoryProvider,
  performanceMeasurementService,
  frontendConfig.appConfig.vertical,
  globalLogger
);

adService.initialize();
