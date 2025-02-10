import jsdom from 'jsdom';
import { googletag } from 'ad-tag/types/googletag';
import { apstag } from 'ad-tag/types/apstag';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';

export type CreateDomOptions = {
  readonly url?: string;
};
export const createDom = (options?: CreateDomOptions): jsdom.JSDOM => {
  const dom = new jsdom.JSDOM('', {
    url: options?.url ?? 'http://localhost',
    referrer: 'http://localhost',
    contentType: 'text/html'
  });

  // provide matchMedia
  dom.window.matchMedia = function (): any {
    return {
      matches: true,
      media: 'screen',
      addListener: function (): void {
        /**/
      },
      removeListener: function (): void {
        /**/
      }
    };
  };
  return dom;
};

export const createDomAndWindow = () => {
  const dom = createDom();
  return {
    dom,
    jsDomWindow: dom.window as any as Window &
      googletag.IGoogleTagWindow &
      apstag.WindowA9 &
      prebidjs.IPrebidjsWindow &
      tcfapi.TCFApiWindow &
      MoliRuntime.MoliWindow &
      Pick<typeof globalThis, 'Date' | 'console'>
  };
};

export const dom = createDom();
