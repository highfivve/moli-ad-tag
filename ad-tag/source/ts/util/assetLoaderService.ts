import domready from '../util/domready';
import {
  IPerformanceMeasurementService, createPerformanceService
} from './performanceService';

export enum AssetLoadMethod {
  FETCH, TAG
}

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
}

export interface IAssetLoaderService {

  /**
   * Loads the script and append it to the DOM.
   *
   * @param config
   * @param parent [optional] the element to which the assetLoader should append the asset. defaults to document.head.
   */
  loadScript(config: ILoadAssetParams, parent?: Element): Promise<void>;
}

export class AssetLoaderService implements IAssetLoaderService {

  constructor(
    private readonly performanceService: IPerformanceMeasurementService,
    private readonly window: Window) {
  }

  public loadScript(config: ILoadAssetParams, parent: Element = this.window.document.head!): Promise<void> {
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
      .then(() => this.measurePerformance(config.name));
  }

  private loadAssetViaFetch(config: ILoadAssetParams, parentElement: Element): Promise<any> {
    return window.fetch(config.assetUrl)
      .then((response: Response) => response.ok ? Promise.resolve(response) : Promise.reject(response))
      .then((response: Response) => response.text())
      .then((body: string) => this.scriptTagWithBody(body))
      .then((element: HTMLElement) => parentElement.appendChild(element));
  }

  private scriptTagWithBody(body: string): HTMLScriptElement {
    const scriptTag = document.createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.async = true;
    scriptTag.text = body;
    return scriptTag;
  }

  private loadAssetViaTag(config: ILoadAssetParams, parentElement: Element): Promise<void> {
    const tag: HTMLElement = this.scriptTagWithSrc(config.assetUrl);

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
    this.performanceService.measure(
      `${name}_load_time`,
      `${name}_load_start`,
      `${name}_load_stop`
    );
  }
}

export const createAssetLoaderService = (window: Window): IAssetLoaderService => new AssetLoaderService(createPerformanceService(window), window);
