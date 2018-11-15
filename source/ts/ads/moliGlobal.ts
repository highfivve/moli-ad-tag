import { Moli } from '../types/moli';
import { DfpService } from './dfpService';
import { assetLoaderService } from '../util/assetLoaderService';
import { cookieService } from '../util/cookieService';

const dfpService = new DfpService(assetLoaderService, cookieService);

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = {
  initialize: dfpService.initialize,
  getConfig: dfpService.getConfig
};
window.moli = moli;
