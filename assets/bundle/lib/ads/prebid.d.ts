import { ConfigureStep, DefineSlotsStep, InitStep, PrepareRequestAdsStep, RequestAdsStep, RequestBidsStep } from './adPipeline';
import { AdServer, headerbidding, schain } from '../types/moliConfig';
export declare const prebidInit: () => InitStep;
export declare const prebidRemoveAdUnits: (prebidConfig: headerbidding.PrebidConfig) => ConfigureStep;
export declare const prebidConfigure: (prebidConfig: headerbidding.PrebidConfig, schainConfig: schain.SupplyChainConfig) => ConfigureStep;
export declare const prebidPrepareRequestAds: (prebidConfig: headerbidding.PrebidConfig) => PrepareRequestAdsStep;
export declare const prebidRequestBids: (prebidConfig: headerbidding.PrebidConfig, adServer: AdServer) => RequestBidsStep;
export declare const prebidDefineSlots: () => DefineSlotsStep;
export declare const prebidRenderAds: () => RequestAdsStep;
