---
id: quick-start
title: Quick start
slug: quick-start
---

Getting started is straightfoward and we will explain a lot of aspects of the ad tag based on this minimal example.

First create an `index.html` with the following content:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Quick Start</title>

    <!-- CMP Stub-->
    <script>
        !function () { var e = function () { var e, t = "__tcfapiLocator", a = [], n = window; for (; n;) { try { if (n.frames[t]) { e = n; break } } catch (e) { } if (n === window.top) break; n = n.parent } e || (!function e() { var a = n.document, r = !!n.frames[t]; if (!r) if (a.body) { var i = a.createElement("iframe"); i.style.cssText = "display:none", i.name = t, a.body.appendChild(i) } else setTimeout(e, 5); return !r }(), n.__tcfapi = function () { for (var e, t = arguments.length, n = new Array(t), r = 0; r < t; r++)n[r] = arguments[r]; if (!n.length) return a; if ("setGdprApplies" === n[0]) n.length > 3 && 2 === parseInt(n[1], 10) && "boolean" == typeof n[3] && (e = n[3], "function" == typeof n[2] && n[2]("set", !0)); else if ("ping" === n[0]) { var i = { gdprApplies: e, cmpLoaded: !1, cmpStatus: "stub" }; "function" == typeof n[2] && n[2](i) } else a.push(n) }, n.addEventListener("message", (function (e) { var t = "string" == typeof e.data, a = {}; try { a = t ? JSON.parse(e.data) : e.data } catch (e) { } var n = a.__tcfapiCall; n && window.__tcfapi(n.command, n.version, (function (a, r) { var i = { __tcfapiReturn: { returnValue: a, success: r, callId: n.callId } }; t && (i = JSON.stringify(i)), e.source.postMessage(i, "*") }), n.parameter) }), !1)) }; "undefined" != typeof module ? module.exports = e : e() }();
    </script>
    <!-- TODO implement a simple CMP stub that always returns full consent? Or at least gdpr applies "false"-->
    <!-- sourcepoint CMP (required) -->
    <script>
    window._sp_ = {
        config: {
            accountId: 270,
            baseEndpoint: 'https://cdn.privacy-mgmt.com',
            propertyHref: 'https://local.h5v.eu'
        }
    }
    </script>
    <script src="https://cdn.privacy-mgmt.com/wrapperMessagingWithoutDetection.js"></script>

    <!-- your ad tag -->
    <script async="async" src="https://assets.h5v.eu/prebuilt/ad-tag/latest.js"></script>

    <!-- configure slots and request ads -->
    <script>
        // setup the command queue
        window.moli = window.moli || {que: []};

        // push callbacks into the queue
        window.moli.que.push(function(adTag) {

            // on the fly configuration
            adTag.configure({
                environment: 'test',
                slots: [
                  {
                    // a div element with this id must be present when the DOM has finished loading
                    domId: 'content_1',

                    // GAM ad unit path
                    adUnitPath: '/1234/content_1',

                    // configure the GAM slot type (out-of-page, interstitial, anchor ad)
                    position: 'in-page',

                    // when and how should the ad slot be loaded
                    behaviour: { loaded: 'eager' },

                    // all sizes this ad slot supports
                    sizes: [[300, 250]],

                    // responsive ads configuration
                    sizeConfig: [
                      { mediaQuery: '(min-width: 0px)', sizesSupported: [[300, 250]] }
                    ]
                  }
                ]
            });

            // start requesting ads
            adTag.requestAds();
        });
      </script>
</head>

<body>
    <h2>content_1</h2>
    <div id="content_1"></div>
    <hr>
</body>

</html>

```

Then start a webserver in this directory. Most OS have python installed so you could use

```bash
$ python -m SimpleHTTPServer 8000
```

And open localhost:8000

🌟 Congratulations 🌟 You have configured and used your first own ad tag. In the folowing chapters
wel will unpack everything that's in this minimal example.
