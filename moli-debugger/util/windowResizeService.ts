import { debounce } from './debounce';

const RESIZE_LISTENER_INTERVAL: number = 200;

/**
 * Services to provide throttled or debounced window events to components.
 *
 * Resize events are debounced such that changing the browser size does not trigger unnecessarily amount of events.
 */

export class WindowResizeService {
  private resizeListeners: Array<IWindowEventObserver> = [];

  constructor() {
    window.addEventListener('resize', debounce(this.emitEvent(), RESIZE_LISTENER_INTERVAL));
  }

  public register(observer: IWindowEventObserver): void {
    if (this.resizeListeners.indexOf(observer) === -1) {
      this.resizeListeners.push(observer);
    }
  }

  public unregister(observer: IWindowEventObserver): void {
    if (this.resizeListeners.indexOf(observer) >= 0) {
      this.resizeListeners.splice(this.resizeListeners.indexOf(observer), 1);
    }
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
