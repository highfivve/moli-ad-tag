function loadStub(window) {
  var e = false;
  var _window = window;
  var _document = window.document;

  function r() {
    if (!_window.frames["__cmpLocator"]) {
      if (_document.body) {
        var a = _document.body;
        var e = _document.createElement("iframe");
        e.style.cssText = "display:none";
        e.name = "__cmpLocator";
        a.appendChild(e)
      } else {
        setTimeout(r, 5)
      }
    }
  }

  r();

  function p() {
    var a = arguments;
    _window.__cmp.a = _window.__cmp.a || [];
    if (!a.length) {
      return _window.__cmp.a
    } else if (a[0] === "ping") {
      a[2]({gdprAppliesGlobally: e, cmpLoaded: false}, true)
    } else {
      _window.__cmp.a.push([].slice.apply(a))
    }
  }

  function l(t) {
    var r = typeof t.data === "string";
    try {
      var a = r ? JSON.parse(t.data) : t.data;
      if (a.__cmpCall) {
        var n = a.__cmpCall;
        _window.__cmp(n.command, n.parameter, function (a, e) {
          var c = {__cmpReturn: {returnValue: a, success: e, callId: n.callId}};
          t.source.postMessage(r ? JSON.stringify(c) : c, "*")
        })
      }
    } catch (a) {
    }
  }

  if (typeof __cmp !== "function") {
    _window.__cmp = p;
    _window.__cmp.msgHandler = l;
    _window.addEventListener("message", l, false)
  }
}

module.exports = loadStub;
