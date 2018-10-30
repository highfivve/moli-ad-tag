import domready = require('domready');
import { IPerformanceMeasurementService, performanceMeasurementService } from '../performanceService';

export enum AssetType {
  SCRIPT, STYLE
}

export enum AssetLoadMethod {
  FETCH, TAG
}

export interface ILoadAssetParams {

  /**
   * The type of asset. Can be SCRIPT (JavaScript) or STYLE (CSS).
   */
  assetType: AssetType;

  /**
   * Short identifier for the style/script. Used for performance measurement and error messages.
   */
  name: string;

  /**
   * Style/Script location
   */
  assetUrl: string;

  /**
   * Configure how to the script is being loaded
   */
  loadMethod: AssetLoadMethod;
}

export interface IAssetLoaderService {

  /**
   * Loads the script and append it to the DOM.
   *
   * @param config
   * @param parent [optional] the element to which the assetLoader should append the asset. defaults to document.head.
   */
  loadAsset(config: ILoadAssetParams, parent?: Element): Promise<void>;
}

export class AssetLoaderService implements IAssetLoaderService {

  constructor(private performanceService: IPerformanceMeasurementService) {}

  public loadAsset(config: ILoadAssetParams, parent: Element = document.head!): Promise<void> {
   return this.awaitDomReady()
     .then(() => this.startPerformance(config.name))
     .then(() => {
        switch (config.loadMethod) {
          case AssetLoadMethod.FETCH: return this.loadAssetViaFetch(config, parent);
          case AssetLoadMethod.TAG: return this.loadAssetViaTag(config, parent);
        }
     })
     .then(() => this.measurePerformance(config.name));
  }

  private loadAssetViaFetch(config: ILoadAssetParams, parentElement: Element): Promise<any> {
    return window.fetch(config.assetUrl)
      .then((response: Response) => response.ok ? Promise.resolve(response) : Promise.reject(response))
      .then((response: Response) => response.text())
      .then((body: string) => {
        switch (config.assetType) {
          case AssetType.SCRIPT: return this.scriptTagWithBody(body);
          case AssetType.STYLE: return this.styleTagWithBody(body);
        }
      })
      .then((element: HTMLElement) => parentElement.appendChild(element));
  }

  private scriptTagWithBody(body: string): HTMLScriptElement {
    const scriptTag = document.createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.async = true;
    scriptTag.text = body;
    return scriptTag;
  }

  private styleTagWithBody(body: string): HTMLStyleElement {
    const styleTag = document.createElement('style');
    styleTag.type = 'text/css';
    styleTag.innerText = body;
    return styleTag;
  }

  private loadAssetViaTag(config: ILoadAssetParams, parentElement: Element): Promise<void> {
    this.performanceService.mark(`${config.name}_load_start`);

    const tag: HTMLElement = config.assetType === AssetType.SCRIPT
      ? this.scriptTagWithSrc(config.assetUrl)
      : this.linkTagWithHref(config.assetUrl);

    return new Promise<void>((resolve: (() => void), reject: (() => void)) => {
      tag.onload = resolve;
      tag.onerror = reject;
      parentElement.appendChild(tag);
    });
  }

  private scriptTagWithSrc(src: string): HTMLScriptElement {
    const scriptTag = document.createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.async = true;
    scriptTag.src = src;
    return scriptTag;
  }

  private linkTagWithHref(href: string): HTMLStyleElement {
    const styleTag = document.createElement('link');
    styleTag.rel = 'stylesheet';
    styleTag.href = href;
    return styleTag;
  }

  /**
   * Returns a promise which resolves once the DOM is in the ready state.
   *
   * @return {Promise<void>}
   */
  private awaitDomReady(): Promise<void> {
    return new Promise<void>((resolve): void => {
      domready(resolve);
    });
  }

  private startPerformance(name: string): void {
    this.performanceService.mark(`${name}_load_start`);
  }

  private measurePerformance(name: string): void {
    this.performanceService.mark(`${name}_load_stop`);
    this.performanceService.measure(
      `${name}_load_time`,
      `${name}_load_start`,
      `${name}_load_stop`
    );
  }
}

/**
 * Cached version of the asset loader service.
 *
 * loadAsset will only trigger once. All following requests with the same assetUrl return the previous promise. If an
 * asset is removed after calling loadAsset it WILL NOT be loaded again!
 */
class CachedAssetLoaderService implements IAssetLoaderService {

  private assetloaderService: IAssetLoaderService;
  private cache: Map<string, Promise<void>>;

  constructor(performanceService: IPerformanceMeasurementService) {
    this.assetloaderService = new AssetLoaderService(performanceService);
    this.cache = new Map();
  }

  public loadAsset(config: ILoadAssetParams): Promise<void> {
    if (!this.cache.has(config.assetUrl)) {
      this.cache.set(config.assetUrl, this.assetloaderService.loadAsset(config));
    }

    return this.cache.get(config.assetUrl)!;
  }
}

export const assetLoaderService: IAssetLoaderService = new AssetLoaderService(performanceMeasurementService);

export const cachedAssetLoaderService: IAssetLoaderService = new CachedAssetLoaderService(performanceMeasurementService);
