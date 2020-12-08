import { debounce } from './debounce';

const RESIZE_LISTENER_INTERVAL: number = 200;

/**
 * Services to provide window resize events to components.
 *
 * Resize events are debounced such that changing the browser size does not trigger unnecessarily amount of events.
 */

export class WindowResizeService {
  private resizeListeners: Set<IWindowEventObserver> = new Set();

  constructor() {
    window.addEventListener('resize', debounce(this.emitEvent(), RESIZE_LISTENER_INTERVAL));
  }

  public register(observer: IWindowEventObserver): void {
    this.resizeListeners.add(observer);
  }

  public unregister(observer: IWindowEventObserver): void {
    this.resizeListeners.delete(observer);
  }

  private emitEvent(): EventListener {
    return (event: Event) => {
      this.resizeListeners.forEach(observer => {
        observer.listener!(event);
      });
    };
  }
}

export interface IWindowEventObserver {
  listener?: EventListener;
}

export default new WindowResizeService();
