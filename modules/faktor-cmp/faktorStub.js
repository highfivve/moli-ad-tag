/**
 * == CMP stub implementation ==
 *
 * Provided by faktor.io to queue up incoming cmp requests before the actual cmp implementation
 * has been fully loaded.
 *
 * == Changes made by gf ==
 *
 * - We moved the `listen('message', ...)` method further down so the __cmp object is actually initialized
 * - We wrapped a function around the faktor.io stub, so that the stub is only loaded when the function is called
 *
 */

function loadCmpFaktorStub(window) {

  if ((!window.__cmp || typeof window.__cmp !== 'function')) {
    var start = window.__cmp ? window.__cmp.start : {};

    window.__cmp = function () {
      function addLocatorFrame() {
        if (!window.frames['__cmpLocator']) {
          if (window.document.body) {
            var frame = window.document.createElement('iframe');
            frame.style.display = 'none';
            frame.name = '__cmpLocator';
            window.document.body.appendChild(frame);
          } else {
            setTimeout(addLocatorFrame, 5);
          }
        }
      }

      addLocatorFrame();

      var commandQueue = [];
      var cmp = function (command, parameter, callback) {
        if (command === 'ping') {
          if (callback) {
            callback({
              gdprAppliesGlobally: !!(window.__cmp && window.__cmp.config && window.__cmp.config.storeConsentGlobally),
              cmpLoaded: false
            });
          }
        } else {
          commandQueue.push({
            command: command,
            parameter: parameter,
            callback: callback
          });
        }
      };
      cmp.commandQueue = commandQueue;
      cmp.receiveMessage = function (event) {
        var data = event && event.data && event.data.__cmpCall;
        if (data) {
          commandQueue.push({
            callId: data.callId,
            command: data.command,
            parameter: data.parameter,
            event: event
          });
        }
      };

      return cmp;
    }();

    var listen = window.attachEvent || window.addEventListener;
    listen('message', function (event) {
      window.__cmp.receiveMessage(event);
    });

    window.__cmp.start = start;
  }

}

module.exports = loadCmpFaktorStub;
