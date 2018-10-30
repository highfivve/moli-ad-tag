import { IVertical } from '../../../config/appConfig';
import { IAdNetworkService } from './IAdNetworkService';
import { ILogger } from '../../../utils/logger';
import { AdInventoryProvider } from './adInventoryProvider';
import { IPerformanceMeasurementService } from '../../performanceService';

export class AdService {
  constructor(
    private adNetworkProviders: IAdNetworkService[],
    private adInventoryProvider: AdInventoryProvider,
    private performanceMeasurementService: IPerformanceMeasurementService,
    private vertical: IVertical,
    private logger: ILogger
  ) {}

  public initialize(): Promise<void> {
    const adSlots = this.adInventoryProvider.adSlotInventory;
    const adConfiguration = this.adInventoryProvider.adConfiguration;

    const adNetworkProviderJobs = this.adNetworkProviders.map((adNetworkProvider: IAdNetworkService) => {
      this.logger.debug(`Initializing ${adNetworkProvider.networkName}`);
      return adNetworkProvider.initialize(adSlots, adConfiguration, this.vertical);
    });

    return Promise.all(adNetworkProviderJobs).then(() => this.adsLoaded())
      .catch(error => this.logger.error('AdService :: Could not initialize ads', error));
  }

  private adsLoaded(): void {
    window.dispatchEvent(new CustomEvent('ads.loaded'));
    this.performanceMeasurementService.markAndSend('show_answer_time');
  }
}
