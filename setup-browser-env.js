// This file is executed prior ava runs tests
require('browser-env')();

global.window.frontendConfig = {
  appConfig: {
    tracker: { ga: '', ub: '' },
    path: {},
    backendHost: '',
    enabledFeatureSwitches: [],
    activeAbTests: [ ]
  }
};

// provide window.requestAnimationFrame & window.cancelAnimationFrame
require('requestanimationframe');
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

 // provide document.registerElement
require('document-register-element');

// Workaround to bring preact working with jsdom
// jsdom still doesn't have SVGElement (see https://github.com/tmpvar/jsdom/issues/1423)
global.SVGElement = function() {};

// XXX evil and naive monkey patch to fake MutationObserver - just for our
// special usecase.
const __document = global.document;
const __origBodyAppendChild = __document.body.appendChild.bind(__document.body);
__document.body.appendChild = function appendChildMonkeyPatch(el) {
  __origBodyAppendChild(el);
  if (el.attachedCallback) { setTimeout(el.attachedCallback.bind(el), 5); }
  if (el.connectedCallback) { setTimeout(el.connectedCallback.bind(el), 5); }
};

// basic storage
const basicBrowserStorage = function () {return {
  _johnnyCash: {},
  getItem: function (key) {
    return this._johnnyCash[key] !== undefined ? this._johnnyCash[key] : null;
  },
  setItem: function (key, value) {
    this._johnnyCash[key] = value;
  },
  removeItem: function(key, _value) {
    this._johnnyCash[key] = undefined;
  },
  clear: function () {
    this._johnnyCash = {};
  }
}};
global.localStorage = global.window.localStorage = basicBrowserStorage();
global.sessionStorage = global.window.sessionStorage = basicBrowserStorage();

// don't do anything on scrollTo
global.window.scrollTo = () => {};

// provide console to see errors from the logger
global.window.console =  console;
global.window.onerror = console.error;

// provide matchMedia
global.window.matchMedia = function() {
  return {
    'matches': false,
    'media': 'screen',
    addListener: function () {},
    removeListener: function() {}
  };
};
