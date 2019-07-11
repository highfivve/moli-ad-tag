// import browserEnv = require('browser-env');
//
// // shared behaviour so it only gets applied once
// browserEnv([ 'window', 'document', 'Event' ]);
//
// // provide matchMedia
// (global as any).window.matchMedia = function (): any {
//   return {
//     'matches': true,
//     'media': 'screen',
//     addListener: function (): void { /**/ },
//     removeListener: function (): void { /**/ }
//   };
// };

import jsdom = require('jsdom');

export const dom = new jsdom.JSDOM('', {
  url: 'http://localhost',
  referrer: 'http://localhost',
  contentType: 'text/html'
});

// provide matchMedia
dom.window.matchMedia = function (): any {
  return {
    'matches': true,
    'media': 'screen',
    addListener: function (): void { /**/ },
    removeListener: function (): void { /**/ }
  };
};

Object.defineProperty(
  global, 'window', dom.window
);

Object.defineProperty(
  global, 'document', dom.window.document
);


Object.defineProperty(
  global, 'Event', dom.window.Event
);
