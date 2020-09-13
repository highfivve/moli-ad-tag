// Pubstack SDK
export const initStub = (_window: any, pubstackGlobal: string, tagId: string): void => {
    const t = _window.pbstck = _window.pbstck || {};
    t.sdk = t.sdk || {};
    const k = t.sdk[tagId] = t.sdk[tagId] || {};
    k.g = pubstackGlobal;
    k.q = k.q || [];
    _window[pubstackGlobal] = {
        cmd: function (): void {
          let a = arguments;
          k.q.push([ 'cmd', a ]);
          (k.p || []).forEach(function (c: any): void {
            c([ 'cmd', a ]);
          });
        }
      };
  };
