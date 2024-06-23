export declare enum AssetLoadMethod {
    FETCH = 0,
    TAG = 1
}
export interface ILoadAssetParams {
    name: string;
    assetUrl: string;
    loadMethod: AssetLoadMethod;
}
export interface IAssetLoaderService {
    loadScript(config: ILoadAssetParams, parent?: Element): Promise<void>;
    loadJson<T>(name: string, assetUrl: string): Promise<T>;
}
export declare class AssetLoaderService implements IAssetLoaderService {
    private readonly window;
    constructor(window: Window);
    loadScript(config: ILoadAssetParams, parent?: Element): Promise<void>;
    loadJson<T>(name: string, assetUrl: string): Promise<T>;
    private loadAssetViaFetch;
    private scriptTagWithBody;
    private loadAssetViaTag;
    private scriptTagWithSrc;
    private awaitDomReady;
}
export declare const createAssetLoaderService: (window: Window) => IAssetLoaderService;
