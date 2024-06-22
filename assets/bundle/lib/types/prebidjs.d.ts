import { SupplyChainObject } from './supplyChainObject';
export declare namespace prebidjs {
    export interface IPrebidjsWindow {
        pbjs: prebidjs.IPrebidJs;
    }
    export interface IPrebidJs {
        que: {
            push(callback: Function): void;
        };
        readonly version: string;
        bidderSettings: IBidderSettings;
        readonly adUnits?: IAdUnit[];
        addAdUnits(adUnits: IAdUnit[]): void;
        removeAdUnit(adUnitCode?: string | string[]): void;
        setTargetingForGPTAsync(adUnit?: string[]): void;
        getConfig(): IPrebidJsConfig;
        readConfig(): IPrebidJsConfig;
        setConfig(config: Partial<IPrebidJsConfig>): void;
        setBidderConfig(configAndBidders: {
            readonly bidders: BidderCode[];
            readonly config: Partial<IPrebidJsConfig>;
        }, mergeFlag?: boolean): void;
        requestBids(requestParam?: IRequestObj): void;
        getAdserverTargeting(): object;
        triggerUserSyncs(): void;
        getUserIds(): userSync.UserIds;
        enableAnalytics(adapters: analytics.AnalyticsAdapter[]): void;
        onEvent: event.OnEventHandler;
        offEvent(event: event.EventName, handler: Function, id?: any): void;
        convertCurrency?(cpm: number, fromCurrency: string, toCurrency: string): number;
        refreshFpd?(): any;
        getHighestCpmBids(adUnitCode?: string): prebidjs.BidResponse[];
        renderAd(iframeDocument: Document, adId: string): void;
        registerSignalSources?: () => void;
        getAllWinningBids(): prebidjs.BidResponse[];
    }
    interface IImproveDigitalConfig {
        readonly improvedigital?: {
            readonly singleRequest: boolean;
            readonly usePrebidSizes: boolean;
        };
    }
    interface IIndexExchangeConfig {
    }
    interface IRubiconConfig {
        readonly rubicon?: {
            readonly singleRequest: boolean;
        };
    }
    interface IAdagioConfig {
        readonly adagio?: {
            readonly siteId?: string;
            readonly useAdUnitCodeAsPlacement?: boolean;
        };
    }
    export namespace targetingcontrols {
        type TargetingKeys = 'BIDDER' | 'AD_ID' | 'PRICE_BUCKET' | 'SIZE' | 'DEAL' | 'SOURCE' | 'FORMAT' | 'UUID' | 'CACHE_ID' | 'CACHE_HOST' | 'ADOMAIN' | 'title' | 'body' | 'body2' | 'privacyLink' | 'privacyIcon' | 'sponsoredBy' | 'image' | 'icon' | 'clickUrl' | 'displayUrl' | 'cta' | 'rating' | 'address' | 'downloads' | 'likes' | 'phone' | 'price' | 'salePrice';
        interface ITargetingControls {
            readonly auctionKeyMaxChars?: number;
            readonly alwaysIncludeDeals?: boolean;
            readonly allowTargetingKeys?: TargetingKeys[];
            readonly addTargetingKeys?: TargetingKeys[];
            readonly allowSendAllBidsTargetingKeys?: TargetingKeys[];
        }
    }
    export namespace consent {
        interface IConsentManagementConfig {
            readonly gdpr?: IGdprConfig;
            readonly usp?: IUspConfig;
        }
        interface IGdprConfig {
            readonly cmpApi?: 'iab';
            readonly timeout?: number;
            readonly allowAuctionWithoutConsent?: boolean;
            readonly defaultGdprScope?: boolean;
            readonly rules?: IGdprConfigRule[];
        }
        interface IGdprConfigRule {
            readonly purpose: 'storage' | 'basicAds' | 'measurement';
            readonly enforcePurpose: boolean;
            readonly enforceVendor: boolean;
            readonly vendorExceptions?: string[];
        }
    }
    export interface IUspConfig {
        readonly cmpApi: 'iab';
        readonly timeout?: number;
    }
    export namespace priceGranularity {
        type PriceGranularityConfig = 'low' | 'medium' | 'high' | 'auto' | 'dense' | ICustomPriceGranularityConfig;
        interface ICustomPriceGranularityConfig {
            readonly buckets: IPriceBucketConfig[];
        }
        interface IMediaTypePriceGranularityConfig {
            readonly video: PriceGranularityConfig;
            readonly 'video-outstream': PriceGranularityConfig;
            readonly banner: PriceGranularityConfig;
            readonly native: PriceGranularityConfig;
        }
        interface IPriceBucketConfig {
            readonly precision?: number;
            readonly max: number;
            readonly increment: number;
        }
    }
    export namespace auctionOptions {
        interface IAuctionOptionsConfig {
            readonly secondaryBidders?: BidderCode[];
            readonly suppressStaleRender?: boolean;
        }
    }
    export namespace realtimedata {
        export interface IDataProvider {
            readonly waitForIt: boolean;
        }
        export interface IGeolocationDataProviderModule extends IDataProvider {
            readonly name: 'geolocation';
            readonly params: {
                readonly requestPermission: boolean;
            };
        }
        export interface ITimeoutDataProviderModule extends IDataProvider {
            readonly name: 'timeout';
            readonly params: {
                readonly endpoint: {
                    readonly url: string;
                };
            };
        }
        export interface IIntersectionDataProviderModule extends IDataProvider {
            readonly name: 'intersection';
        }
        export interface IConfiantDataProviderModule extends IDataProvider {
            readonly name: 'confiant';
            readonly params: {
                readonly propertyId: string;
                readonly prebidExcludeBidders?: string;
                readonly prebidNameSpace?: string;
                readonly shouldEmitBillableEvent?: boolean;
            };
        }
        type DataProvider = IGeolocationDataProviderModule | ITimeoutDataProviderModule | IIntersectionDataProviderModule | IConfiantDataProviderModule;
        export interface IRealTimeDataConfig {
            readonly auctionDelay: number;
            readonly dataProviders: DataProvider[];
        }
        export {};
    }
    export namespace userSync {
        export interface IUserSyncConfig {
            readonly syncEnabled?: boolean;
            readonly syncDelay?: number;
            readonly auctionDelay?: number;
            readonly syncsPerBidder?: number;
            readonly filterSettings?: IFilterSettingsConfig;
            readonly enableOverride?: boolean;
            readonly userIds?: UserIdProvider[];
            readonly encryptedSignalSources?: IEncryptedSignalSourcesConfig;
            readonly ppid?: EIDSource;
        }
        export type UserIdProvider = IUnifiedIdProvider | IDigitTrustProvider | ICriteoProvider | IID5Provider | IIdentityLinkProvider | IPubCommonIdProvider | IZeotapIdPlusIdProvider | IUtiqIdProvider | ISharedIdProvider | IPairIdProvider;
        interface IUserIdProvider<N extends string> {
            readonly name: N;
            readonly storage?: IUserIdStorage;
        }
        interface IParameterizedUserIdProvider<P, N extends string> extends IUserIdProvider<N> {
            readonly params: P;
        }
        export interface IUserIdStorage {
            readonly type: 'cookie' | 'html5';
            readonly name: string;
            readonly expires: number;
            readonly refreshInSeconds?: number;
            readonly value?: any;
        }
        export interface IUnifiedIdProviderParams {
            readonly partner?: string;
            readonly url?: string;
            readonly value?: {
                readonly tdid: string;
            };
        }
        export interface IUnifiedIdProvider extends IParameterizedUserIdProvider<IUnifiedIdProviderParams, 'unifiedId'> {
        }
        export interface ICriteoProvider extends IUserIdProvider<'criteo'> {
        }
        export interface IDigitTrustProviderParams {
            readonly init: {
                readonly member: string;
                readonly site: string;
            };
            readonly callback?: (result: any) => void;
        }
        export interface IDigitTrustProvider extends IParameterizedUserIdProvider<IDigitTrustProviderParams, 'digitrust'> {
        }
        export interface IPairIdParams {
            readonly liveramp?: {
                readonly storageKey?: string;
            };
        }
        export interface IPairIdProvider extends IParameterizedUserIdProvider<IPairIdParams, 'pairId'> {
        }
        export interface IID5ProviderParams {
            readonly partner: number;
            readonly pd?: string;
        }
        export interface IID5Provider extends IParameterizedUserIdProvider<IID5ProviderParams, 'id5Id'> {
        }
        export interface IIdentityLinkProviderParams {
            readonly pid: string;
            readonly notUse3P: boolean;
        }
        export interface IIdentityLinkProvider extends IParameterizedUserIdProvider<IIdentityLinkProviderParams, 'identityLink'> {
        }
        export interface IPubCommonIdProvider extends IUserIdProvider<'pubCommonId'> {
        }
        export interface IUtiqIdProviderParams {
            readonly maxDelayTime: number;
        }
        export interface IUtiqIdProvider extends IParameterizedUserIdProvider<IUtiqIdProviderParams, 'utiq'> {
            readonly bidders: BidderCode[];
        }
        export interface IZeotapIdPlusIdProvider extends IUserIdProvider<'zeotapIdPlus'> {
        }
        export interface IFilterSettingsConfig {
            readonly all?: IFilterSetting;
            readonly iframe?: IFilterSetting;
            readonly image?: IFilterSetting;
        }
        export interface IFilterSetting {
            readonly bidders: BidderCode[] | '*';
            readonly filter: 'include' | 'exclude';
        }
        export interface IEncryptedSignalSourcesConfig {
            readonly sources: IEncryptedSignalSource[];
            readonly registerDelay?: number;
        }
        export type EIDSource = '33across.com' | 'trustpid.com' | 'adserver.org' | 'navegg.com' | 'justtag.com' | 'id5-sync.com' | 'flashtalking.com' | 'parrable.com' | 'liveramp.com' | 'liveintent.com' | 'merkleinc.com' | 'britepool.com' | 'hcn.health' | 'criteo.com' | 'netid.de' | 'zeotap.com' | 'audigent.com' | 'quantcast.com' | 'verizonmedia.com' | 'mediawallahscript.com' | 'tapad.com' | 'novatiq.com' | 'uidapi.com' | 'admixer.net' | 'deepintent.com' | 'kpuid.com' | 'yahoo.com' | 'thenewco.it' | 'pubcid.org';
        export interface IEncryptedSignalSource {
            readonly source: EIDSource[];
            readonly encrypt: boolean;
            readonly customFunc?: () => any;
        }
        export interface ISharedIdProvider extends IParameterizedUserIdProvider<ISharedIdParams, 'sharedId'> {
        }
        export interface ISharedIdParams {
            readonly create?: boolean;
            readonly pixelUrl?: string;
            readonly extend?: boolean;
        }
        export type UserIds = {
            readonly criteoId?: string;
            readonly pubcid?: string;
            readonly amxId?: string;
            readonly idl_env?: string;
            readonly IDP?: string;
            readonly id5id?: {
                readonly uid: string;
            };
            readonly pairId?: {
                readonly name: string;
                readonly params?: {
                    readonly liveramp?: {
                        readonly storageKey?: string;
                    };
                };
            };
        };
        export {};
    }
    export namespace event {
        type EventName = 'auctionInit' | 'auctionEnd' | 'auctionTimeout' | 'beforeRequestBids' | 'bidRequested' | 'bidResponse' | 'bidAdjustment' | 'bidWon' | 'noBid' | 'bidTimeout' | 'setTargeting' | 'requestBids' | 'addAdUnits' | 'adRenderFailed' | 'auctionDebug' | 'bidderDone' | 'tcf2Enforcement' | 'beforeBidderHttp';
        type UntypedEventName = Exclude<EventName, 'bidWon'>;
        type OnEventHandler = {
            (event: 'bidWon', handler: (bidResponse: BidResponse) => void, id?: string): void;
            (event: 'noBid', handler: (bid: NoBidObject) => void, id?: string): void;
            (event: 'auctionInit', handler: (auction: AuctionObject) => void, id?: string): void;
            (event: 'bidResponse', handler: (bidResponse: BidResponse) => void, id?: string): void;
            (event: 'bidTimeout', handler: (bid: NoBidObject[]) => void, id?: string): void;
            (event: 'auctionTimeout', handler: (auction: AuctionObject) => void, id?: string): void;
            (event: 'auctionEnd', handler: (auction: AuctionObject) => void, id?: string): void;
            (event: UntypedEventName, bid: any, id?: string): void;
        };
        type GdprConsent = {
            readonly addtlConsent?: string;
            readonly apiVersion?: number;
            readonly consentString?: string;
            readonly gdprApplies?: boolean;
            readonly vendorData?: any;
        };
        type BidderRequest = {
            readonly adUnitsS2SCopy?: IAdUnit[];
            readonly auctionId?: string;
            readonly auctionStart?: number;
            readonly bidderCode?: BidderCode;
            readonly bidderRequestId?: string;
            readonly bids?: [];
            readonly gdprConsent?: GdprConsent;
            readonly metrics?: any;
            readonly ortb2?: firstpartydata.PrebidFirstPartyData;
            readonly refererInfo?: any;
            readonly src?: string;
            readonly start?: number;
            readonly timeout?: number;
            readonly uniquePbsTid?: string;
        };
        type AuctionObject = {
            readonly adUnitCodes: string[];
            readonly adUnits?: IAdUnit[];
            readonly auctionId: string;
            readonly auctionStatus?: 'inProgress' | 'completed';
            readonly bidderRequests?: BidderRequest[];
            readonly bidsReceived?: prebidjs.BidResponse[];
            readonly bidsRejected?: NoBidObject[];
            readonly metrics?: any;
            readonly noBids?: NoBidObject[];
            readonly seatNonBids?: any[];
            readonly timeout?: number;
            readonly timestamp?: number;
            readonly winningBids: prebidjs.BidResponse[];
        };
        type NoBidObject = {
            readonly adId: string;
            readonly adUnitCode: string;
            readonly adUnitId?: string;
            readonly auctionId: string;
            readonly bidId?: string;
            readonly bidRequestsCount?: number;
            readonly bidder: string;
            readonly bidderCode: string;
            readonly bidderRequestId?: string;
            readonly bidderRequestsCount?: number;
            readonly bidderWinsCount?: number;
            readonly floorData?: floors.IFloorConfig;
            readonly mediaTypes?: IMediaTypes;
            readonly metrics?: any;
            readonly ortb2?: firstpartydata.PrebidFirstPartyData;
            readonly ortb2Imp?: IOrtb2Imp;
            readonly params?: any;
            readonly schain?: SupplyChainObject.ISupplyChainObject;
            readonly sizes?: [number, number][];
            readonly src?: 'client' | 's2s';
            readonly timeout?: number;
            readonly transactionId?: string;
            readonly userId?: userSync.UserIds;
            readonly userIdsAsEids?: any;
        };
    }
    export namespace currency {
        type ICurrency = 'EUR' | 'USD' | 'GBP';
        type IBidderCurrencyDefault = {
            [bidder in BidderCode]: ICurrency;
        };
        interface ICurrencyConfig {
            readonly adServerCurrency: ICurrency;
            readonly granularityMultiplier: 1;
            readonly defaultRates: {
                USD: {
                    EUR: number;
                };
            };
            readonly bidderCurrencyDefault?: IBidderCurrencyDefault;
        }
    }
    export namespace server {
        type S2SConfig = IS2SConfig & IS2STestingConfig;
        type Endpoint = {
            readonly p1Consent: string;
            readonly noP1Consent?: string;
        };
        interface IS2SConfig {
            readonly accountId: string;
            readonly bidders: ReadonlyArray<BidderCode>;
            readonly name?: string;
            readonly defaultVendor?: BidderCode;
            readonly allowUnknownBidderCodes?: boolean;
            readonly enabled: boolean;
            readonly timeout: number;
            readonly adapter: 'prebidServer';
            readonly endpoint: Endpoint;
            readonly syncEndpoint: Endpoint;
            readonly userSyncLimit?: number;
            readonly syncTimeout?: number;
            readonly coopSync?: boolean;
            readonly defaultTtl?: number;
            readonly adapterOptions?: AdapterOptions;
            readonly extPrebid?: ExtPrebid;
            readonly syncUrlModifier?: any;
        }
        interface IS2STestingConfig {
            readonly testing?: boolean;
            readonly testServerOnly?: boolean;
            readonly bidderControl?: {
                readonly [bidder in BidderCode]?: BidderControl;
            };
        }
        type BidderControl = {
            readonly bidSource: BidSource;
            readonly includeSourceKvp: boolean;
        };
        type BidSource = {
            readonly client: number;
            readonly server: number;
        } | {
            readonly client: 100;
        } | {
            readonly server: 100;
        };
        type AdapterOptions = {
            readonly [bidder in BidderCode]?: any;
        };
        type ExtPrebid = {
            readonly returnallbidstatus?: boolean;
            readonly cache?: {
                readonly vastxml?: {
                    readonly returnCreative: boolean;
                };
            };
            readonly targeting?: {
                readonly pricegranularity: {
                    readonly ranges: Readonly<priceGranularity.IPriceBucketConfig>;
                };
                readonly includewinners?: boolean;
                readonly includebidderkeys?: boolean;
                readonly includeformat?: boolean;
                readonly preferdeals?: boolean;
            };
            readonly storedrequest?: StoredRequest;
            readonly analytics?: {
                h5v: {
                    moliVersion: string;
                    adTagVersion: string | undefined;
                };
            };
        };
        type StoredRequest = {
            readonly id: string;
        };
    }
    export namespace gptPreAuction {
        interface GptPreAuctionConfig {
            readonly enabled?: boolean;
            readonly mcmEnabled?: boolean;
            readonly customGptSlotMatching?: (gptSlotObj: any) => boolean;
            readonly customPbAdSlot?: (adUnitCode: string, adServerSlot: string) => string;
        }
    }
    export namespace analytics {
        type AnalyticsAdapter = IGoogleAnalyticsAdapter;
        type AnalyticsProviders = 'ga';
        interface IAnalyticsAdapter<T> {
            readonly provider: AnalyticsProviders;
            readonly options: T;
        }
        interface IGoogleAnalyticsAdapterOptions {
            readonly global?: string;
            readonly trackerName?: string;
            readonly enableDistribution?: boolean;
            readonly sampling?: number;
        }
        interface IGoogleAnalyticsAdapter extends IAnalyticsAdapter<IGoogleAnalyticsAdapterOptions> {
            readonly provider: 'ga';
        }
    }
    export namespace firstpartydata {
        const enum ContentQuality {
            Unknown = 0,
            ProfessionallyProduced = 1,
            Prosumer = 2,
            UGC = 3
        }
        interface OpenRtb2Site {
            cat?: string[];
            sectioncat?: string[];
            pagecat?: string[];
            mobile?: 0 | 1;
            privacypolicy?: 0 | 1;
            keywords?: string;
            page?: string;
            content?: {
                title?: string;
                url?: string;
                prodq?: ContentQuality;
                userrating?: number;
                keywords?: string;
                language?: string;
                data?: OpenRtb2Data[];
            };
            ext?: any;
        }
        interface OpenRtb2Data {
            id?: string;
            name: string;
            segment: OpenRtb2Segment[];
            ext?: any;
        }
        interface OpenRtb2Segment {
            id?: string;
            name?: string;
            value?: string;
            ext?: any;
        }
        interface CriteoOpenRtb2UserExt {
            readonly deviceidtype?: 'gaid' | 'idfa';
            readonly deviceid?: string;
            readonly data?: {
                readonly eids: CriteoOpenRtb2UserExtEids[];
            };
        }
        interface CriteoOpenRtb2UserExtEids {
            readonly source: string;
            readonly uids: CriteoOpenRtb2UserExtUid[];
        }
        interface CriteoOpenRtb2UserExtUid {
            readonly id: string;
            readonly atype: 3;
            readonly ext: {
                readonly stype: 'cleartextemail' | 'hemsha256' | 'hemmd5' | 'hemsha256md5';
            };
        }
        interface OpenRtb2User {
            yob?: number;
            gender?: 'M' | 'F' | 'O';
            keywords?: string;
            ext?: any & CriteoOpenRtb2UserExt;
        }
        interface OpenRtb2Publisher {
            cat?: string[];
            ext?: any;
        }
        interface OpenRtb2RegsExtDsaTransparency {
            domain: string;
            params: Array<1 | 2 | 3>;
        }
        interface OpenRtb2RegsExtDsa {
            dsa: {
                required: 0 | 1 | 2 | 3;
                pubrender: 0 | 1 | 2;
                datatopub: 0 | 1 | 2;
                transparency: OpenRtb2RegsExtDsaTransparency[];
            };
        }
        interface OpenRtb2Regs {
            ext?: OpenRtb2RegsExtDsa;
        }
        interface PrebidFirstPartyData {
            site?: OpenRtb2Site;
            user?: OpenRtb2User;
            publisher?: OpenRtb2Publisher;
            regs?: OpenRtb2Regs;
        }
        type OpenRtb2 = PrebidFirstPartyData;
    }
    export interface IPrebidJsConfig extends IImproveDigitalConfig, IRubiconConfig, IIndexExchangeConfig, IAdagioConfig {
        readonly debug?: boolean;
        readonly bidderTimeout?: number;
        readonly disableAjaxTimeout?: boolean;
        readonly timeoutBuffer?: number;
        readonly deviceAccess?: boolean;
        readonly maxRequestsPerOrigin?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
        readonly maxNestedIframes?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
        readonly enableSendAllBids?: boolean;
        readonly useBidCache?: boolean;
        readonly bidCacheFilterFunction?: (bid: any) => boolean;
        readonly bidderSequence?: 'random' | 'fixed';
        readonly eventHistoryTTL?: number;
        readonly publisherDomain?: string;
        readonly pageUrl?: string;
        readonly priceGranularity?: priceGranularity.PriceGranularityConfig;
        readonly mediaTypePriceGranularity?: priceGranularity.IMediaTypePriceGranularityConfig;
        readonly targetingControls?: targetingcontrols.ITargetingControls;
        readonly consentManagement?: consent.IConsentManagementConfig;
        readonly realTimeData?: realtimedata.IRealTimeDataConfig;
        readonly userSync?: userSync.IUserSyncConfig;
        readonly currency: currency.ICurrencyConfig;
        readonly s2sConfig?: server.S2SConfig | ReadonlyArray<server.S2SConfig>;
        readonly gptPreAuction?: gptPreAuction.GptPreAuctionConfig;
        readonly ortb2?: firstpartydata.PrebidFirstPartyData;
        readonly floors?: floors.IFloorConfig;
        readonly schain?: schain.ISupplyChainConfig;
        readonly enableTIDs?: boolean;
        readonly allowActivities?: activitycontrols.IAllowActivities;
    }
    export interface IMediaTypeBanner {
        readonly sizes: [number, number][];
    }
    export namespace schain {
        interface ISupplyChainConfig {
            readonly validation: 'strict' | 'relaxed' | 'off';
            readonly config: SupplyChainObject.ISupplyChainObject;
        }
    }
    export namespace video {
        const enum Skip {
            NO = 0,
            YES = 1
        }
        const enum Protocol {
            VAST_1 = 1,
            VAST_2 = 2,
            VAST_3 = 3,
            VAST_1_WRAPPER = 4,
            VAST_2_WRAPPER = 5,
            VAST_3_WRAPPER = 6,
            VAST_4 = 7,
            VAST_4_WRAPPER = 8,
            DAAST_1 = 9,
            DAAST_1_WRAPPER = 10
        }
        const enum PlaybackMethod {
            AutoPlaySoundOff = 1,
            AutoPlaySoundOn = 2,
            ClickToPlay = 3,
            MousOver = 4,
            InViewportSoundsOn = 5,
            InViewportSoundsOff = 6
        }
        const enum Api {
            VPAID_1 = 1,
            VPAID_2 = 2,
            MRAID_1 = 3,
            ORMMA = 4,
            MRAID_2 = 5,
            MRAID_3 = 6
        }
        const enum Placement {
            InStream = 1,
            InBanner = 2,
            InArticle = 3,
            InFeed = 4,
            Interstitial = 5
        }
        const enum Plcmt {
            Instream = 1,
            AccompanyingContent = 2,
            Interstitial = 3,
            NoContentStandalone = 4
        }
        const enum CreativeAttributes {
            AudioAdAutoPlay = 1,
            AudioAdUserInitiated = 2,
            ExpandableAutomatic = 3,
            ExpandableOnClick = 4,
            ExpandableOnRollover = 5,
            InBannerVideoAdAutoPlay = 6,
            InBannerVideoAdClick = 7,
            Pop = 8,
            ProvocativeOrSuggestiveImagery = 9,
            ShakyFlashingFlickering = 10,
            Surveys = 11,
            TextOnly = 12,
            UserInteractive = 13,
            WindowsDialogOrAlertStyle = 14,
            HasAudioOnOffButton = 15,
            HasSkipButton = 16,
            AdobeFlash = 16
        }
        const enum Linearity {
            LinerInStream = 1,
            NonLinearOverlay = 2
        }
        type MimeType = 'video/mp4' | 'video/webm' | 'video/flv' | 'video/H264' | 'video/ogg' | 'video/MPV';
    }
    export interface IMediaTypeVideo {
        readonly context: 'outstream' | 'instream' | 'adpod';
        readonly playerSize: [number, number][] | [number, number] | undefined;
        readonly api: video.Api[];
        readonly mimes: video.MimeType[];
        readonly protocols: video.Protocol[];
        readonly playbackmethod: video.PlaybackMethod[];
        readonly minduration: number;
        readonly maxduration: number;
        readonly w?: number;
        readonly h?: number;
        readonly startdelay: number;
        readonly skip: video.Skip;
        readonly battr?: video.CreativeAttributes[];
        readonly placement: video.Placement;
        readonly plcmt: video.Plcmt;
        readonly minbitrate?: number;
        readonly maxbitrate?: number;
        readonly linearity?: video.Linearity;
        readonly renderer?: IRenderer;
    }
    interface IMediaTypeNativeRequirement {
        readonly required: boolean;
        readonly sendId?: boolean;
    }
    interface IMediaTypeNativeRequirementWithLength extends IMediaTypeNativeRequirement {
        readonly len?: number;
    }
    type MediaTypeNativeAspectRatio = {
        readonly min_width?: number;
        readonly min_height?: number;
        readonly ratio_width: number;
        readonly ratio_height: number;
    };
    interface IMediaTypeNativeRequirementImage extends IMediaTypeNativeRequirement {
        readonly sizes?: [number, number] | [number, number][];
        readonly aspect_ratios?: MediaTypeNativeAspectRatio[];
    }
    export interface IMediaTypeNative {
        readonly sendTargetingKeys?: boolean;
        readonly adTemplate?: string;
        readonly rendererUrl?: string;
        readonly type?: 'image';
        readonly title?: IMediaTypeNativeRequirementWithLength;
        readonly body?: IMediaTypeNativeRequirementWithLength;
        readonly body2?: IMediaTypeNativeRequirement;
        readonly sponsoredBy?: IMediaTypeNativeRequirement;
        readonly icon?: IMediaTypeNativeRequirementImage;
        readonly image?: IMediaTypeNativeRequirementImage;
        readonly clickUrl?: IMediaTypeNativeRequirement;
        readonly displayUrl?: IMediaTypeNativeRequirement;
        readonly privacyLink?: IMediaTypeNativeRequirement;
        readonly privacyIcon?: IMediaTypeNativeRequirement;
        readonly cta?: IMediaTypeNativeRequirement;
        readonly rating?: IMediaTypeNativeRequirement;
        readonly downloads?: IMediaTypeNativeRequirement;
        readonly likes?: IMediaTypeNativeRequirement;
        readonly price?: IMediaTypeNativeRequirement;
        readonly salePrice?: IMediaTypeNativeRequirement;
        readonly address?: IMediaTypeNativeRequirement;
        readonly phone?: IMediaTypeNativeRequirement;
    }
    export interface ITitleAssetParams {
        readonly len: number;
    }
    export interface IImageAssetParams {
        readonly type?: 1 | 3;
        readonly wmin?: number;
        readonly hmin?: number;
        readonly w?: number;
        readonly h?: number;
    }
    export interface IDataAssetParams {
        readonly type: number;
    }
    export interface INativeAssetOrtb {
        readonly id: number;
        readonly required?: 0 | 1;
    }
    export interface INativeImgAssetOrtb extends INativeAssetOrtb {
        readonly img: IImageAssetParams;
    }
    export interface INativeTitleAssetOrtb extends INativeAssetOrtb {
        readonly title: ITitleAssetParams;
    }
    export interface INativeDataAssetOrtb extends INativeAssetOrtb {
        readonly data: IDataAssetParams;
    }
    export type NativeAssetOrtb = INativeImgAssetOrtb | INativeDataAssetOrtb | INativeTitleAssetOrtb;
    export interface INativeEventtrackers {
        event: number;
        methods: number[];
    }
    export interface IOrtbNativeSpecs {
        readonly ver?: string;
        readonly assets: NativeAssetOrtb[];
        readonly eventtrackers?: INativeEventtrackers[];
        readonly privacy?: 0 | 1;
    }
    export interface IMediaTypeNativeOrtb {
        readonly adTemplate?: string;
        readonly rendererUrl?: string;
        readonly ortb: IOrtbNativeSpecs;
        readonly sendTargetingKeys?: boolean;
    }
    export interface IMediaTypes {
        readonly banner?: IMediaTypeBanner;
        readonly video?: IMediaTypeVideo;
        readonly native?: IMediaTypeNative | IMediaTypeNativeOrtb;
    }
    export interface IRenderer {
        readonly url: string;
        readonly render: (bid: any) => void;
        readonly backupOnly?: boolean;
        readonly options?: any;
    }
    export interface IAdUnit {
        readonly code?: string;
        readonly mediaTypes: IMediaTypes;
        readonly bids: IBid[];
        readonly renderer?: IRenderer;
        readonly pubstack?: IPubstackConfig;
        readonly ortb2Imp?: IOrtb2Imp;
        readonly floors?: floors.IFloorsData;
    }
    export interface IPubstackConfig {
        readonly adUnitName?: string;
        readonly adUnitPath?: string;
        readonly tags?: string[];
    }
    export interface IOrtb2ImpPrebid {
        readonly bidder?: {
            readonly [Bidder in BidderCode]: any;
        };
        readonly storedrequest?: IOrtb2ImpStoredRequest;
    }
    export interface IOrtb2ImpStoredRequest {
        readonly id?: string;
    }
    export interface IOrtb2Imp {
        readonly ext?: {
            readonly data?: any;
            readonly prebid?: IOrtb2ImpPrebid;
        };
    }
    export const Adagio = "adagio";
    export const AdaptMx = "amx";
    export const Adform = "adf";
    export const AdUp = "aduptech";
    export const Criteo = "criteo";
    export const ConnectAd = "connectad";
    export const AppNexusAst = "appnexusAst";
    export const AppNexus = "appnexus";
    export const GumGum = "gumgum";
    export const ImproveDigital = "improvedigital";
    export const IndexExchange = "ix";
    export const Invibes = "invibes";
    export const NanoInteractive = "nanointeractive";
    export const PubMatic = "pubmatic";
    export const Ogury = "ogury";
    export const OneTag = "onetag";
    export const OpenX = "openx";
    export const SmartAdServer = "smartadserver";
    export const Smartx = "smartx";
    export const Unruly = "unruly";
    export const Teads = "teads";
    export const Triplelift = "triplelift";
    export const Yieldlab = "yieldlab";
    export const Seedtag = "seedtag";
    export const Spotx = "spotx";
    export const ShowHeroes = "showheroesBs";
    export const StroeerCore = "stroeerCore";
    export const Xaxis = "xhb";
    export const DSPX = "dspx";
    export const Rubicon = "rubicon";
    export const Recognified = "rads";
    export const Visx = "visx";
    export const Vlyby = "vlyby";
    export const Orbidder = "orbidder";
    export type BidderCode = typeof Adagio | typeof AdaptMx | typeof AdUp | typeof Adform | typeof ConnectAd | typeof Criteo | typeof AppNexusAst | typeof AppNexus | typeof GumGum | typeof ImproveDigital | typeof IndexExchange | typeof Invibes | typeof NanoInteractive | typeof PubMatic | typeof Ogury | typeof OneTag | typeof OpenX | typeof SmartAdServer | typeof Smartx | typeof Unruly | typeof Teads | typeof Triplelift | typeof Yieldlab | typeof Seedtag | typeof Spotx | typeof ShowHeroes | typeof StroeerCore | typeof Xaxis | typeof DSPX | typeof Rubicon | typeof Recognified | typeof Visx | typeof Vlyby | typeof Orbidder;
    export interface IBidObject<B extends BidderCode, T> {
        readonly bidder: B;
        readonly params: T;
        readonly labelAny?: string[];
        readonly labelAll?: string[];
        readonly bidSource?: server.BidSource;
    }
    export interface IAdagioParams {
        readonly organizationId: string;
        readonly site: string;
        readonly placement: string;
        readonly adUnitElementId?: string;
        readonly useAdUnitCodeAsAdUnitElementId?: boolean;
        readonly pagetype?: string;
        readonly category?: string;
        readonly native?: any;
        readonly splitKeyword?: string;
    }
    export interface IAdagioBid extends IBidObject<typeof Adagio, IAdagioParams> {
    }
    export interface IAdaptMxParams {
        readonly tagId: string;
        readonly testMode?: boolean;
        readonly adUnitId?: string;
    }
    export interface IAdaptMxBid extends IBidObject<typeof AdaptMx, IAdaptMxParams> {
    }
    export interface IAdformParams {
        readonly mid: number;
        readonly adxDomain?: string;
        readonly priceType?: 'net' | 'gross';
        readonly mkv?: string;
        readonly mkw?: string;
        readonly minp?: number;
        readonly cdims?: string;
        readonly url?: string;
    }
    export interface IAdformBid extends IBidObject<typeof Adform, IAdformParams> {
    }
    export interface IAdUpParams {
        readonly publisher: string;
        readonly placement: string;
        readonly query?: string;
        readonly adtest?: boolean;
    }
    export interface IAdUpBid extends IBidObject<typeof AdUp, IAdUpParams> {
    }
    export interface IConnectAdParams {
        readonly siteId: number;
        readonly networkId: number;
    }
    export interface IConnectAdBid extends IBidObject<typeof ConnectAd, IConnectAdParams> {
    }
    export interface ICriteoParams {
        readonly zoneId?: number;
        readonly networkId: number;
        readonly publisherSubId?: string;
    }
    export interface ICriteoBid extends IBidObject<typeof Criteo, ICriteoParams> {
    }
    export interface IAppNexusASTKeyword {
        [key: string]: string[];
    }
    type AppNexusASTAppDeviceId = {
        readonly idfa: string;
    } | {
        readonly aaid: string;
    } | {
        readonly md5udid: string;
    } | {
        readonly shad1udid: string;
    } | {
        readonly windowsadid: string;
    };
    export interface IAppNexusASTApp {
        readonly id?: string;
        readonly device_id: AppNexusASTAppDeviceId;
        readonly geo?: {
            readonly lat: number;
            readonly lng: number;
        };
    }
    export interface IAppNexusASTPrebidServerKeyword {
        readonly key: string;
        readonly value: string[];
    }
    export interface IAppNexusASTParams {
        readonly placementId: string | number;
        readonly allowSmallerSizes?: boolean;
        readonly keywords?: IAppNexusASTKeyword | IAppNexusASTPrebidServerKeyword[];
        readonly reserve?: number;
        readonly supplyType?: 'web' | 'mobile_web' | 'mobile_app';
        readonly video?: {
            readonly mimes?: string[];
            readonly minduration?: number;
            readonly maxduration?: number;
            readonly startdelay?: number;
            readonly skippable?: boolean;
            readonly playback_method?: Array<'auto_play_sound_on' | 'auto_play_sound_off' | 'click_to_play' | 'mouseover' | 'auto_play_sound_unknown'>;
            readonly frameworks?: Array<0 | 1 | 2 | 3 | 4 | 5>;
        };
        readonly app?: IAppNexusASTApp;
    }
    export interface IAppNexusASTBid extends IBidObject<typeof AppNexusAst | typeof AppNexus, IAppNexusASTParams> {
    }
    export interface IGumGumParams {
        readonly zone: string;
        readonly pubId?: number;
        readonly irisid?: string;
        readonly iriscat?: string;
        readonly slot?: number | string;
        readonly product?: 'skins';
    }
    export interface IGumGumBid extends IBidObject<typeof GumGum, IGumGumParams> {
    }
    export interface IImproveDigitalParams {
        readonly placementId: number;
        readonly keyValues?: {
            [key: string]: string[];
        };
        readonly bidFloor?: number;
        readonly bidFloorCur?: 'EUR';
    }
    export interface IImproveDigitalBid extends IBidObject<typeof ImproveDigital, IImproveDigitalParams> {
    }
    export interface IIndexExchangeParams {
        readonly siteId: string | number;
        readonly size?: [number, number];
        readonly bidFloor?: number;
        readonly bidFloorCur?: 'EUR';
    }
    export interface IIndexExchangeBid extends IBidObject<typeof IndexExchange, IIndexExchangeParams> {
    }
    export interface IInvibesParams {
        readonly placementId: string;
        readonly domainId?: number;
        readonly customEndpoint?: number;
    }
    export interface IInvibesBid extends IBidObject<typeof Invibes, IInvibesParams> {
    }
    export interface IPrebidServerBidParams {
        readonly configName: string;
    }
    export interface IPrebidServerBid extends Omit<IBidObject<any, IPrebidServerBidParams>, 'bidder'> {
        readonly bidder?: never;
        readonly module: 'pbsBidAdapter';
        readonly params: IPrebidServerBidParams;
        readonly ortb2Imp: IOrtb2Imp & {
            readonly prebid: IOrtb2ImpPrebid & {
                readonly storedrequest: IOrtb2ImpStoredRequest;
            };
        };
    }
    export interface IPubMaticParams {
        readonly publisherId: string;
        readonly adSlot: string;
        readonly kadfloor?: string;
        readonly currency?: 'EUR' | 'USD';
        readonly outstreamAU?: string;
        readonly video?: {
            readonly mimes: Array<'video/mp4' | 'video/webm' | 'video/flv' | 'video/H264' | 'video/ogg' | 'video/MPV'>;
            readonly skippable?: boolean;
            readonly minduration?: number;
            readonly maxduration?: number;
            readonly playbackmethod?: 1 | 2 | 3 | 4;
            readonly api?: Array<1 | 2 | 3 | 4 | 5>;
            readonly protocols?: Array<1 | 2 | 3 | 4 | 5 | 6>;
            readonly battr?: number[];
            readonly linearity?: 1 | 2;
            readonly placement?: 1 | 2 | 3 | 4 | 5;
            readonly minbitrate?: number;
            readonly maxbitrate?: number;
        };
    }
    export interface IPubMaticBid extends IBidObject<typeof PubMatic, IPubMaticParams> {
    }
    export interface INanoInteractiveParams {
        readonly sec: string;
        readonly dpid: string;
        readonly pid: string;
        readonly nq?: string;
        readonly name?: string;
        readonly category: string;
    }
    export interface INanoInteractiveBid extends IBidObject<typeof NanoInteractive, INanoInteractiveParams> {
    }
    export interface IOguryParams {
        readonly assetKey: string;
        readonly adUnitId: string;
        readonly skipSizeCheck?: boolean;
        readonly gravity?: 'TOP_LEFT' | 'TOP_RIGHT' | 'TOP_CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_CENTER' | 'CENTER';
        readonly xMargin?: number;
        readonly yMargin?: number;
        readonly headerSelector?: string;
        readonly headerStickiness?: 'STICKY' | 'NON_STICKY';
        readonly adSlotSelector?: string;
    }
    export interface IOguryBid extends IBidObject<typeof Ogury, IOguryParams> {
    }
    export interface IOneTagParams {
        readonly publisherId: string;
        readonly ext: {
            readonly placement_name?: string;
            readonly [key: string]: string | undefined;
        };
    }
    export interface IOneTagBid extends IBidObject<typeof OneTag, IOneTagParams> {
    }
    export interface IOpenxParams {
        delDomain: string;
        unit: string;
        readonly customFloor?: number;
    }
    export interface IOpenxBid extends IBidObject<typeof OpenX, IOpenxParams> {
    }
    export interface ISmartAdServerParams {
        readonly domain: string;
        readonly siteId: number;
        readonly pageId: number;
        readonly formatId: number;
        readonly currency?: 'EUR' | 'USD';
        readonly bidfloor?: number;
        readonly video?: {
            readonly protocol: number;
            readonly startDelay?: 1 | 2 | 3;
        };
    }
    export interface ISmartAdServerPrebidServerParams {
        readonly networkId: number;
        readonly siteId?: number;
        readonly pageId?: number;
        readonly formatId?: number;
        readonly target?: string;
    }
    export interface ISmartAdServerBid extends IBidObject<typeof SmartAdServer, ISmartAdServerParams | ISmartAdServerPrebidServerParams> {
    }
    export interface ISmartxParams {
        readonly tagId: string;
        readonly publisherId: string;
        readonly siteId: string;
        readonly bidfloor?: number;
        readonly bidfloorcur?: currency.ICurrency;
        readonly context?: string;
        readonly outstream_options?: {
            readonly slot: string;
            readonly minAdWidth?: number;
            readonly maxAdWidth?: number;
            readonly title?: string;
            readonly skipOffset?: number;
            readonly startOpen?: string;
            readonly endingScreen?: string;
            readonly desiredBitrate?: number;
            readonly visibilityThreshold?: number;
        };
        readonly secure?: boolean;
        readonly mimes?: string[];
        readonly price_floor?: number;
        readonly min_duration?: number;
        readonly max_duration?: number;
    }
    export interface ISmartxBid extends IBidObject<typeof Smartx, ISmartxParams> {
    }
    export interface IUnrulyParams {
        readonly siteId: number;
        readonly targetingUUID?: string;
    }
    export interface IUnrulyBid extends IBidObject<typeof Unruly, IUnrulyParams> {
    }
    export interface ITeadsParams {
        pageId: number;
        placementId: number;
    }
    export interface ITeadsBid extends IBidObject<typeof Teads, ITeadsParams> {
    }
    export interface IYieldlabParams {
        readonly adslotId: string;
        readonly supplyId: string;
        readonly adSize?: string;
        readonly targeting?: {
            [key: string]: string;
        };
    }
    export interface IYieldlabBid extends IBidObject<typeof Yieldlab, IYieldlabParams> {
    }
    export interface ISeedtagParams {
        readonly publisherId: string;
        readonly adUnitId: string;
        readonly placement: 'inScreen' | 'inArticle' | 'inBanner';
    }
    export interface ISeedtagBid extends IBidObject<typeof Seedtag, ISeedtagParams> {
    }
    export interface ISpotxParams {
        readonly channel_id: string;
        readonly ad_unit: 'instream' | 'outstream';
        readonly outstream_options: {
            readonly slot: string;
            readonly secure?: boolean;
            readonly mimes?: Array<'application/javascript' | 'video/mp4' | 'video/webm' | 'application/x-shockwave-flash'>;
            readonly ad_mute?: boolean;
            readonly playersize_auto_adapt?: boolean;
            readonly in_iframe?: string;
            readonly custom_override?: {
                readonly autoplay?: 0 | 1;
                readonly content_width?: string;
                readonly content_height?: string;
            };
        };
        readonly ad_volume?: number;
        readonly hide_skin?: boolean;
        readonly custom?: {
            [key: string]: string | number | string[];
        };
    }
    export interface ISpotXBid extends IBidObject<typeof Spotx, ISpotxParams> {
    }
    export interface IShowHeroesParams {
        readonly playerId: string;
        readonly vpaidMode?: boolean;
    }
    export interface IShowHeroesBid extends IBidObject<typeof ShowHeroes, IShowHeroesParams> {
    }
    export interface IXaxisParams {
        readonly placementId: string;
        readonly keywords?: IAppNexusASTKeyword;
        readonly reserve?: number;
    }
    export interface IXaxisBid extends IBidObject<typeof Xaxis, IXaxisParams> {
    }
    export interface IDSPXParams {
        readonly placement: string;
        readonly devMode?: boolean;
        readonly pfilter?: {
            readonly floorprice?: number;
            readonly private_auction?: 0 | 1;
            readonly injTagId?: string;
        };
    }
    export interface IDSPXBid extends IBidObject<typeof DSPX, IDSPXParams> {
    }
    export interface IRubiconParams {
        readonly accountId: string;
        readonly siteId: string;
        readonly zoneId: string;
        readonly bidonmultiformat?: boolean;
        readonly sizes?: number[];
        readonly inventory?: {
            [key: string]: string[];
        };
        readonly visitor?: {
            [key: string]: string[];
        };
        readonly position?: 'atf' | 'btf';
        readonly userId?: string;
        readonly floor?: number;
        readonly video?: {
            readonly size_id?: 203 | 201;
            readonly language?: string;
        };
    }
    export interface IRubiconBid extends IBidObject<typeof Rubicon, IRubiconParams> {
    }
    export interface IVlybyParams {
        readonly publisherId: string;
        readonly placement?: string;
    }
    export interface IVlybyBid extends IBidObject<typeof Vlyby, IVlybyParams> {
    }
    export interface IVisxParams {
        readonly uid: string | number;
    }
    export interface IVisxBid extends IBidObject<typeof Visx, IVisxParams> {
    }
    export interface IRecognifiedParams {
        readonly placement: string;
    }
    export interface IRecognifiedBid extends IBidObject<typeof Recognified, IRecognifiedParams> {
    }
    export interface IOrbidderParams {
        readonly accountId: string;
        readonly placementId: string;
        readonly bidfloor?: number;
        readonly keyValues?: {
            [key: string]: string;
        };
    }
    export interface IOrbidderBid extends IBidObject<typeof Orbidder, IOrbidderParams> {
    }
    export interface IStroeerParams {
        readonly sid: string;
    }
    export interface IStroeerCoreBid extends IBidObject<typeof StroeerCore, IStroeerParams> {
    }
    export type IBid = IAdagioBid | IAdaptMxBid | IAdformBid | IAdUpBid | IConnectAdBid | ICriteoBid | IAppNexusASTBid | IGumGumBid | IImproveDigitalBid | IIndexExchangeBid | IInvibesBid | INanoInteractiveBid | IPrebidServerBid | IPubMaticBid | IOguryBid | IOneTagBid | IOpenxBid | ISmartAdServerBid | ISmartxBid | IUnrulyBid | ITeadsBid | IYieldlabBid | ISeedtagBid | ISpotXBid | IShowHeroesBid | IStroeerCoreBid | IXaxisBid | IDSPXBid | IRubiconBid | IRecognifiedBid | IVlybyBid | IVisxBid | IOrbidderBid;
    export interface IRequestObj {
        adUnitCodes?: string[];
        adUnits?: IAdUnit[];
        readonly timeout?: number;
        readonly labels?: string[];
        readonly bidsBackHandler?: (bidResponses: IBidResponsesMap | undefined, timedOut: boolean, auctionId: string) => void;
        readonly auctionId?: string;
        readonly ortb2?: firstpartydata.OpenRtb2;
        readonly ttlBuffer?: number;
    }
    export interface IBidResponsesMap {
        [adUnitCode: string]: {
            bids: prebidjs.BidResponse[];
        } | undefined;
    }
    export interface IBidResponse {
        readonly requestId: string;
        readonly bidder: BidderCode;
        readonly ad: string | any;
        readonly auctionId: string;
        readonly adUnitCode: string;
        readonly cpm: number;
        readonly originalCpm?: number;
        readonly adId: string;
        readonly width?: number;
        readonly height?: number;
        readonly size: string;
        readonly mediaType: 'banner' | 'video' | 'display';
        readonly source: 'client' | 's2s';
        readonly currency: string;
        readonly originalCurrency: string;
        readonly netRevenue: boolean;
        readonly ttl?: number;
        readonly dealId?: string;
        readonly creativeId?: number;
        readonly status: 'rendered' | 'targetingSet';
        readonly statusMessage: 'Bid returned empty or error response' | 'Bid available';
        readonly vastXml?: string;
        readonly vastImpUrl?: string;
        readonly native: {
            readonly address?: string;
            readonly body?: string;
            readonly body2?: string;
            readonly cta?: string;
            readonly clickTrackers?: string[];
            readonly clickUrl?: string;
            readonly displayUrl?: string;
            readonly downloads?: string;
            readonly image?: {
                readonly url: string;
                readonly height: number;
                readonly width: number;
            };
            readonly impressionTrackers?: string[];
            readonly javascriptTrackers?: string;
            readonly likes?: any;
            readonly phone?: string;
            readonly price?: string;
            readonly privacyLink?: string;
            readonly rating?: string;
            readonly salePrice?: string;
            readonly sponsoredBy?: string;
            readonly title?: string;
        };
        readonly adserverTargeting: {
            readonly hb_bidder: string;
            readonly hb_adid: string;
            readonly hb_pb: string;
            readonly hb_size: string;
            readonly hb_source: string;
            readonly hb_format: string;
            readonly hb_adomain: string;
        };
        readonly responseTimestamp: number;
        readonly requestTimestamp: number;
        readonly timeToRespond: number;
        readonly meta?: {
            readonly advertiserDomains?: string[];
            readonly networkName?: string;
            readonly networkId?: string;
            readonly brandId?: number;
            readonly brandName?: string;
        };
        readonly pbLg: string;
        readonly pbMg: string;
        readonly pbHg: string;
        readonly pbAg: string;
        readonly pbDg: string;
        readonly pbCg: string;
    }
    export interface IGenericBidResponse extends IBidResponse {
        readonly bidder: Exclude<BidderCode, typeof GumGum>;
    }
    export interface IGumGumBidResponseWrapper {
        readonly auid: number;
    }
    export interface IGumGumBidResponse extends IBidResponse {
        readonly bidder: typeof GumGum;
        readonly ad: IGumGumBidResponseWrapper | string;
    }
    export type BidResponse = IGenericBidResponse | IGumGumBidResponse;
    export type IBidderSettings = {
        [bidder in BidderCode | 'standard']?: IBidderSetting;
    };
    export interface IBidderSetting {
        readonly adserverTargeting?: IAdServerTargeting[];
        readonly bidCpmAdjustment?: (bidCpm: number, bid: IBidResponse) => number;
        readonly sendStandardTargeting?: boolean;
        readonly suppressEmptyKeys?: boolean;
        readonly allowZeroCpmBids?: boolean;
        readonly storageAllowed?: boolean;
        readonly allowAlternateBidderCodes?: boolean;
        readonly allowedAlternateBidderCodes?: BidderCode[] | ['*'];
    }
    export interface IAdServerTargeting {
        readonly key: string;
        val(bidResponse: IBidResponse): string | undefined;
    }
    export namespace activitycontrols {
        export interface IActivityRuleDefaultParams {
            readonly component: string;
            readonly componentType: string;
            readonly componentName: string;
        }
        type ACTIVITY_PARAM_STORAGE_TYPE = {
            readonly storageType: 'html5' | 'cookie';
        };
        type ACTIVITY_PARAM_S2S_NAME = {
            readonly configName: string;
        };
        type ACTIVITY_PARAM_SYNC_TYPE = {
            readonly syncType: 'iframe' | 'pixel';
        };
        type ACTIVITY_PARAM_SYNC_URL = {
            readonly syncUrl: string;
        };
        export interface IActivityRule<Param> {
            readonly condition?: (param: Param & IActivityRuleDefaultParams) => boolean;
            readonly allow?: boolean;
            readonly priority?: number;
        }
        export interface IActivity<Param = {}> {
            readonly default?: boolean;
            readonly rules: IActivityRule<Param>[];
        }
        export interface IAllowActivities {
            readonly accessDevice?: IActivity<ACTIVITY_PARAM_STORAGE_TYPE>;
            readonly enrichEids?: IActivity;
            readonly enrichUfpd?: IActivity;
            readonly fetchBids?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
            readonly reportAnalytics?: IActivity;
            readonly syncUser?: IActivity<ACTIVITY_PARAM_SYNC_TYPE & ACTIVITY_PARAM_SYNC_URL>;
            readonly transmitEids?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
            readonly transmitPreciseGeo?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
            readonly transmitTid?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
            readonly transmitUfpd?: IActivity<ACTIVITY_PARAM_S2S_NAME>;
        }
        export {};
    }
    export namespace floors {
        interface IFloorConfig {
            readonly enabled?: boolean;
            readonly enforcement?: IFloorEnforcementConfig;
            readonly floorMin?: number;
            readonly floorProvider?: string;
            readonly skipRate?: number;
            readonly data?: IFloorsData;
        }
        interface IFloorEnforcementConfig {
            readonly auctionDelay?: number;
            readonly floorMin?: number;
            readonly floorDeals?: boolean;
            readonly bidAdjustment?: boolean;
            readonly enforceJS?: boolean;
            readonly enforcePBS?: boolean;
            readonly endpoint?: IFloorEndpoint;
        }
        interface IFloorEndpoint {
            readonly url: string;
        }
        type IFloorSchemaFields = 'gptSlot' | 'adUnitCode' | 'mediaType' | 'size' | 'domain';
        interface IFloorSchema {
            readonly delimiter: string;
            readonly fields: IFloorSchemaFields[];
        }
        interface IFloorValues {
            [key: string]: number;
        }
        interface IFloorsData {
            readonly floorProvider?: string;
            readonly modelVersion?: string;
            readonly floorsSchemaVersion?: 1 | 2;
            readonly skipRate?: number;
            readonly currency?: currency.ICurrency;
            readonly schema?: IFloorSchema;
            readonly values?: IFloorValues;
            readonly default?: number;
        }
    }
    export {};
}
