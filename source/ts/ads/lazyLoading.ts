import { EventType, IWindowEventObserver, IWindowEventService } from '../../dom/windowEventService';
import {IQueryService} from '../../dom/queryService';
import {IScrollService} from '../../dom/scrollService';
/**
 * == Lazy Loader ==
 *
 * Class to define lazy loading logic for Ads.
 *
 */
export interface ILazyLoader {

  /**
   * @returns {Promise<void>} a promise that resolves when the lazy loaded content should be triggered
   */
  onLoad(): Promise<void>;
}

/**
 * When the footer is visible the lazy loading logic is triggered.
 *
 * @param queryService
 * @param scrollService
 * @param windowEventService
 * @returns {ILazyLoader} a lazy loader
 */
export const FooterVisible = (
  queryService: IQueryService,
  scrollService: IScrollService,
  windowEventService: IWindowEventService,
): ILazyLoader => {

  let isResolved: boolean = false;
  return {
    onLoad(): Promise<void> {
      return new Promise<void>((resolve): void => {
        // we use the footer to determine if the ad should be displayed as the element
        // has display:none , thus we cannot determine the visibility.
        const footer = queryService.querySelector('footer');
        const windowEventObserver: IWindowEventObserver = {
          listener: () => {
            if (scrollService.elementInOrAboveViewport(footer) && !isResolved) {
              isResolved = true;
              resolve();
            }
          }
        };
        windowEventService.register(EventType.Scroll, windowEventObserver);
      });
    }
  };
};

/**
 * Resolves the ad slot when the sidebar is tall enough for this ad slot.
 *
 * @see qdp-sidebar/index.ts for implementation details
 * @returns {ILazyLoader}
 */
export const QdpSidebar2Loaded = (): ILazyLoader => {
  let isResolved: boolean = false;
  return {
    onLoad(): Promise<void> {
      return new Promise<void>((resolve): void => {
        window.addEventListener('qdp.sidebar.2.loaded', () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        });
      });
    }
  };
};
