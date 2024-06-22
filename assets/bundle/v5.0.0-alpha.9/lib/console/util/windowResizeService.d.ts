export declare class WindowResizeService {
    private resizeListeners;
    constructor();
    register(observer: IWindowEventObserver): void;
    unregister(observer: IWindowEventObserver): void;
    private emitEvent;
}
export interface IWindowEventObserver {
    listener?: EventListener;
}
declare const _default: WindowResizeService;
export default _default;
