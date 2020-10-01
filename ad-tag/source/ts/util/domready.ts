type Callback = () => void;
/*!
 * domready (c) Dustin Diaz 2014 - License MIT
 * @see {@link https://github.com/ded/domready}
 */
export default (window: Window, callback: Callback): void => {
  let callbacks: Callback[] = [],
    listener: any,
    doc = typeof window.document === 'object' && window.document,
    hack = doc && (doc.documentElement as any).doScroll,
    domContentLoaded = 'DOMContentLoaded',
    loaded = doc && (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState);

  if (!loaded && doc) {
    doc.addEventListener(
      domContentLoaded,
      (listener = () => {
        if (doc) {
          doc.removeEventListener(domContentLoaded, listener);
          loaded = true;
          while ((listener = callbacks.shift())) {
            listener();
          }
        }
      })
    );
  }

  loaded ? setTimeout(callback, 0) : callbacks.push(callback);
};
