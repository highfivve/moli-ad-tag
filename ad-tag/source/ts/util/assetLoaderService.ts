import domready from '../util/domready';
import { IPerformanceMeasurementService, createPerformanceService } from './performanceService';

/**
 * @internal
 */
export enum AssetLoadMethod {
  FETCH,
  TAG
}

/**
 * @internal
 */
export interface ILoadAssetParams {
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

  /**
   * [optional] type of the script tag. Defaults to 'text/javascript'
   */
  type?: 'module' | 'nomodule';
}

/**
 * @internal
 */
export interface IAssetLoaderService {
  /**
   * Loads the script and append it to the DOM.
   *
   * @param config
   * @param parent [optional] the element to which the assetLoader should append the asset. defaults to document.head.
   */
  loadScript(config: ILoadAssetParams, parent?: Element): Promise<void>;

  /**
   * Loads a JSON asset from the given assetURL.
   *
   * @param name human readable name of the asset that should be fetched. Used to measure loading performance
   * @param assetUrl the asset url
   */
  loadJson<T>(name: string, assetUrl: string): Promise<T>;
}

/**
 * @internal
 */
export class AssetLoaderService implements IAssetLoaderService {
  constructor(
    private readonly performanceService: IPerformanceMeasurementService,
    private readonly window: Window
  ) {}

  public loadScript(
    config: ILoadAssetParams,
    parent: Element = this.window.document.head!
  ): Promise<void> {
    return this.awaitDomReady()
      .then(() => this.startPerformance(config.name))
      .then(() => {
        switch (config.loadMethod) {
          case AssetLoadMethod.FETCH:
            return this.loadAssetViaFetch(config, parent);
          case AssetLoadMethod.TAG:
            return this.loadAssetViaTag(config, parent);
        }
      })
      .finally(() => this.measurePerformance(config.name));
  }

  public loadJson<T>(name: string, assetUrl: string): Promise<T> {
    this.startPerformance(name);
    return this.window
      .fetch(assetUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        this.measurePerformance(name);
        return response.ok
          ? response.json()
          : response
              .text()
              .then(errorMessage => Promise.reject(`${response.statusText}: ${errorMessage}`));
      })
      .catch(error => {
        this.measurePerformance(name);
        return Promise.reject(error);
      });
  }

  private loadAssetViaFetch(config: ILoadAssetParams, parentElement: Element): Promise<any> {
    return this.window
      .fetch(config.assetUrl)
      .then((response: Response) =>
        response.ok ? Promise.resolve(response) : Promise.reject(response)
      )
      .then((response: Response) => response.text())
      .then((body: string) => this.scriptTagWithBody(body))
      .then((element: HTMLElement) => parentElement.appendChild(element));
  }

  private scriptTagWithBody(body: string): HTMLScriptElement {
    const scriptTag = this.window.document.createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.async = true;
    scriptTag.text = body;
    return scriptTag;
  }

  private loadAssetViaTag(config: ILoadAssetParams, parentElement: Element): Promise<void> {
    const tag: HTMLElement = this.scriptTag(config);

    return new Promise<void>((resolve: () => void, reject: () => void) => {
      tag.onload = resolve;
      tag.onerror = reject;
      parentElement.appendChild(tag);
    });
  }

  private scriptTag(config: ILoadAssetParams): HTMLScriptElement {
    const scriptTag = this.window.document.createElement('script');
    scriptTag.type = config.type || 'text/javascript';
    scriptTag.async = true;
    scriptTag.src = config.assetUrl;
    return scriptTag;
  }

  /**
   * Returns a promise which resolves once the DOM is in the ready state.
   *
   * @return {Promise<void>}
   */
  private awaitDomReady(): Promise<void> {
    return new Promise<void>((resolve): void => {
      domready(this.window, resolve);
    });
  }

  private startPerformance(name: string): void {
    this.performanceService.mark(`${name}_load_start`);
  }

  private measurePerformance(name: string): void {
    this.performanceService.mark(`${name}_load_stop`);
    this.performanceService.measure(`${name}_load_time`, `${name}_load_start`, `${name}_load_stop`);
  }
}

/**
 * @internal
 */
export const createAssetLoaderService = (window: Window): IAssetLoaderService =>
  new AssetLoaderService(createPerformanceService(window), window);
