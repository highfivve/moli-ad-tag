import { ConfigureStep, InitStep, PrepareRequestAdsStep, RequestBidsStep } from './adPipeline';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { headerbidding, schain } from '../types/moliConfig';
export declare const a9Init: (config: headerbidding.A9Config, assetService: IAssetLoaderService) => InitStep;
export declare const a9Configure: (config: headerbidding.A9Config, schainConfig: schain.SupplyChainConfig) => ConfigureStep;
export declare const a9PublisherAudiences: (config: headerbidding.A9Config) => ConfigureStep;
export declare const a9ClearTargetingStep: () => PrepareRequestAdsStep;
export declare const a9RequestBids: (config: headerbidding.A9Config) => RequestBidsStep;
