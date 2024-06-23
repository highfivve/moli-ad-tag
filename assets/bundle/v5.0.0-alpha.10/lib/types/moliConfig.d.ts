import { prebidjs } from './prebidjs';
import { SupplyChainObject } from './supplyChainObject';
import { apstag } from './apstag';
import { UserActivityLevelControl } from '../ads/modules/ad-reload/userActivityService';
import { AdexAppConfig } from '../ads/modules/adex';
import { MappingDefinition } from '../ads/modules/adex/adex-mapping';
import { BlocklistProvider } from '../ads/modules/blocklist-url';
export type GoogleAdManagerSlotSize = [number, number] | 'fluid';
export interface GoogleAdManagerKeyValueMap {
    [key: string]: string | string[] | undefined;
}
export type Device = 'mobile' | 'desktop' | 'android' | 'ios';
export type AdServer = 'gam' | 'prebidjs';
export type Environment = 'production' | 'test';
export type AdUnitPathVariables = {
    readonly [key: string]: string;
};
export interface Targeting {
    readonly keyValues: GoogleAdManagerKeyValueMap;
    readonly adManagerExcludes?: string[];
    readonly labels?: string[];
    readonly adUnitPathVariables?: AdUnitPathVariables;
}
export interface SinglePageAppConfig {
    readonly enabled: boolean;
    readonly destroyAllAdSlots?: boolean;
    readonly validateLocation: 'href' | 'path' | 'none';
}
export interface SizeConfigEntry<Label = string> {
    readonly mediaQuery: string;
    readonly labelAll?: Label[];
    readonly labelNone?: Label[];
    readonly sizesSupported: GoogleAdManagerSlotSize[];
}
export interface LabelSizeConfigEntry {
    readonly mediaQuery: string;
    readonly labelsSupported: string[];
}
export type IPosition = 'in-page' | 'out-of-page' | 'out-of-page-interstitial' | 'out-of-page-top-anchor' | 'out-of-page-bottom-anchor';
export interface AdSlot {
    readonly domId: string;
    readonly adUnitPath: string;
    readonly sizes: GoogleAdManagerSlotSize[];
    readonly position: IPosition;
    readonly behaviour: behaviour.SlotLoading;
    readonly labelAny?: string[];
    readonly labelAll?: string[];
    readonly sizeConfig: SizeConfigEntry[];
    readonly gpt?: gpt.GptAdSlotConfig;
    readonly prebid?: headerbidding.PrebidAdSlotConfigProvider;
    readonly a9?: headerbidding.A9AdSlotConfig;
    readonly passbackSupport?: boolean;
}
export type ResolveAdUnitPathOptions = {
    readonly removeNetworkChildId?: boolean;
};
export declare namespace consent {
    interface ConsentConfig {
        readonly enabled?: boolean;
        readonly disableLegitimateInterest?: boolean;
        readonly useLimitedAds?: boolean;
    }
}
export declare namespace auction {
    interface AdRequestThrottlingConfig {
        readonly enabled: boolean;
        throttle: number;
    }
    interface BidderDisablingConfig {
        readonly enabled: boolean;
        readonly minRate: number;
        readonly minBidRequests: number;
        readonly reactivationPeriod: number;
    }
    interface GlobalAuctionContextConfig {
        readonly biddersDisabling?: BidderDisablingConfig;
        readonly adRequestThrottling?: AdRequestThrottlingConfig;
    }
}
export declare namespace behaviour {
    interface ISlotLoading {
        readonly loaded: 'eager' | 'manual' | 'infinite' | 'backfill';
        readonly bucket?: string;
    }
    interface Eager extends ISlotLoading {
        readonly loaded: 'eager';
    }
    interface Manual extends ISlotLoading {
        readonly loaded: 'manual';
    }
    interface Infinite extends ISlotLoading {
        readonly loaded: 'infinite';
        readonly selector: string;
    }
    interface Backfill extends ISlotLoading {
        readonly loaded: 'backfill';
    }
    type SlotLoading = Eager | Manual | Infinite | Backfill;
    type Trigger = EventTrigger;
    interface EventTrigger {
        readonly name: 'event';
        readonly event: string;
        readonly source: Window | Document | string;
    }
}
export declare namespace gpt {
    interface GptAdSlotConfig {
        collapseEmptyDiv?: boolean;
    }
}
export declare namespace headerbidding {
    type PrebidAdSlotConfigProvider = PrebidAdSlotConfig | PrebidAdSlotConfig[];
    type BidderSupplyChainNode = {
        readonly bidder: prebidjs.BidderCode;
        readonly node: SupplyChainObject.ISupplyChainNode;
        readonly appendNode: boolean;
    };
    interface PrebidConfig {
        readonly config: prebidjs.IPrebidJsConfig;
        readonly bidderSettings?: prebidjs.IBidderSettings;
        readonly schain: {
            readonly nodes: BidderSupplyChainNode[];
        };
        readonly ephemeralAdUnits?: boolean;
        readonly failsafeTimeout?: number;
    }
    interface PrebidAdSlotConfig {
        readonly adUnit: prebidjs.IAdUnit;
    }
    interface A9PublisherAudienceConfig {
        readonly enabled: boolean;
        readonly sha256Email: string;
    }
    type A9SlotNamePathDepth = 3 | 4 | 5;
    interface A9Config {
        readonly pubID: string;
        readonly scriptUrl?: string;
        readonly timeout: number;
        readonly cmpTimeout: number;
        readonly enableFloorPrices?: boolean;
        readonly floorPriceCurrency?: apstag.Currency;
        readonly supportedSizes?: GoogleAdManagerSlotSize[];
        readonly publisherAudience?: A9PublisherAudienceConfig;
        readonly slotNamePathDepth?: A9SlotNamePathDepth;
        readonly schainNode: SupplyChainObject.ISupplyChainNode;
    }
    interface A9AdSlotConfig {
        readonly labelAll?: string[];
        readonly labelAny?: string[];
        readonly mediaType?: 'display' | 'video';
        readonly slotNamePathDepth?: A9SlotNamePathDepth;
    }
}
export declare namespace schain {
    interface SupplyChainConfig {
        readonly supplyChainStartNode: SupplyChainObject.ISupplyChainNode;
    }
}
export declare namespace bucket {
    interface GlobalBucketConfig {
        readonly enabled: boolean;
        readonly bucket?: BucketConfigMap;
    }
    interface BucketConfig {
        readonly timeout: number;
    }
    type BucketConfigMap = {
        readonly [bucketName: string]: BucketConfig;
    };
}
export interface CSSDeletionMethod {
    readonly cssSelectors: string[];
}
export interface JSDeletionMethod {
    readonly jsAsString: string[];
}
export interface CleanupConfig {
    readonly bidder: prebidjs.BidderCode;
    readonly domId: string;
    readonly deleteMethod: CSSDeletionMethod | JSDeletionMethod;
}
export declare namespace modules {
    interface IModuleConfig {
        readonly enabled: boolean;
    }
    namespace adreload {
        type RefreshIntervalOverrides = {
            [slotDomId: string]: number;
        };
        interface AdReloadModuleConfig extends IModuleConfig {
            excludeAdSlotDomIds: string[];
            optimizeClsScoreDomIds: string[];
            includeAdvertiserIds: number[];
            includeYieldGroupIds: number[];
            includeOrderIds: number[];
            excludeOrderIds: number[];
            refreshIntervalMs?: number;
            refreshIntervalMsOverrides?: RefreshIntervalOverrides;
            userActivityLevelControl?: UserActivityLevelControl;
            disableAdVisibilityChecks?: boolean;
        }
    }
    namespace cleanup {
        interface CleanupModuleConfig extends IModuleConfig {
            readonly enabled: boolean;
            readonly configs: CleanupConfig[];
        }
    }
    namespace pubstack {
        interface PubstackConfig extends IModuleConfig {
            readonly tagId: string;
        }
    }
    namespace confiant {
        interface ConfiantConfig extends IModuleConfig {
            readonly assetUrl: string;
            readonly checkGVLID?: boolean;
        }
    }
    namespace adex {
        interface AdexConfig extends IModuleConfig {
            readonly adexCustomerId: string;
            readonly adexTagId: string;
            readonly spaMode: boolean;
            readonly mappingDefinitions: Array<MappingDefinition>;
            readonly appConfig?: AdexAppConfig;
        }
    }
    namespace blocklist {
        interface BlocklistUrlsBlockingConfig extends IModuleConfig {
            readonly mode: 'block';
            readonly blocklist: BlocklistProvider;
        }
        interface BlocklistUrlsKeyValueConfig extends IModuleConfig {
            readonly mode: 'key-value';
            readonly blocklist: BlocklistProvider;
            readonly key: string;
            readonly isBlocklistedValue?: string;
        }
    }
    namespace skin {
        interface SkinModuleConfig extends IModuleConfig {
            readonly configs: SkinConfig[];
            readonly trackSkinCpmLow?: (cpms: {
                skin: number;
                combinedNonSkinSlots: number;
            }, skinConfig: SkinConfig, skinBid: prebidjs.IBidResponse) => void;
        }
        type AllFormatFilter = {
            readonly bidder: '*';
        };
        type GumGumFormatFilter = {
            readonly bidder: typeof prebidjs.GumGum;
            readonly auid?: number;
        };
        type AzerionFormatFilter = {
            readonly bidder: typeof prebidjs.ImproveDigital;
        };
        type DSPXFormatFilter = {
            readonly bidder: typeof prebidjs.DSPX;
        };
        type VisxFormatFilter = {
            readonly bidder: typeof prebidjs.Visx;
        };
        type XandrFormatFilter = {
            readonly bidder: typeof prebidjs.AppNexusAst | typeof prebidjs.AppNexus;
        };
        type YieldlabFormatFilter = {
            readonly bidder: typeof prebidjs.Yieldlab;
        };
        type FormatFilter = AllFormatFilter | AzerionFormatFilter | GumGumFormatFilter | DSPXFormatFilter | VisxFormatFilter | YieldlabFormatFilter | XandrFormatFilter;
        type SkinConfig = {
            readonly formatFilter: FormatFilter[];
            readonly skinAdSlotDomId: string;
            readonly blockedAdSlotDomIds: string[];
            readonly hideSkinAdSlot: boolean;
            readonly hideBlockedSlots: boolean;
            readonly enableCpmComparison: boolean;
            hideBlockedSlotsSelector?: string;
            readonly destroySkinSlot?: boolean;
            readonly adReload?: {
                intervalMs: number;
                allowed: prebidjs.BidderCode[];
            };
        };
    }
    interface ModulesConfig {
        readonly adReload?: adreload.AdReloadModuleConfig;
        readonly cleanup?: cleanup.CleanupModuleConfig;
        readonly pubstack?: pubstack.PubstackConfig;
        readonly confiant?: confiant.ConfiantConfig;
        readonly blocklist?: blocklist.BlocklistUrlsBlockingConfig | blocklist.BlocklistUrlsKeyValueConfig;
        readonly adex?: adex.AdexConfig;
        readonly skin?: skin.SkinModuleConfig;
    }
}
export interface MoliConfig {
    readonly version?: string;
    readonly adServer?: AdServer;
    readonly domain?: string;
    readonly slots: AdSlot[];
    readonly spa?: SinglePageAppConfig;
    readonly schain: schain.SupplyChainConfig;
    targeting?: Targeting;
    labelSizeConfig?: LabelSizeConfigEntry[];
    readonly consent?: consent.ConsentConfig;
    readonly prebid?: headerbidding.PrebidConfig;
    readonly a9?: headerbidding.A9Config;
    readonly globalAuctionContext?: auction.GlobalAuctionContextConfig;
    readonly modules?: modules.ModulesConfig;
    readonly buckets?: bucket.GlobalBucketConfig;
}
