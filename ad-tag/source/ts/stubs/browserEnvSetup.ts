import jsdom = require('jsdom');

export const createDom = (): jsdom.JSDOM => {
  const dom = new jsdom.JSDOM('', {
    url: 'http://localhost',
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

export const dom = createDom();
