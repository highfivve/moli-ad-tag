# Generic IAB CMP module

Provides a generic CMP module that provides readiness checking and a cmp stub.

## Integration

In your `index.ts` import sourcepoint cmp and register the module.

```js
import Cmp from '@highfivve/modules/sourcepoint-cmp';
moli.registerModule(new Cmp(270, 'https://message.sp-prod.net', window));
```

On the publisher page add [the sourcepoint cmp stub code](https://documentation.sourcepoint.com/web-implementation/sourcepoint-gdpr-and-tcf-v2-support-beta/gdpr-and-tcf-v2-setup-and-configuration_v1.1.3#1-two-step-process-to-implement-the-gdpr-and-tcf-v2-code-snippet)

```html
<script type="text/javascript">
    !function () { var e = function () { var e, t = "__tcfapiLocator", a = [], n = window; for (; n;) { try { if (n.frames[t]) { e = n; break } } catch (e) { } if (n === window.top) break; n = n.parent } e || (!function e() { var a = n.document, r = !!n.frames[t]; if (!r) if (a.body) { var i = a.createElement("iframe"); i.style.cssText = "display:none", i.name = t, a.body.appendChild(i) } else setTimeout(e, 5); return !r }(), n.__tcfapi = function () { for (var e, t = arguments.length, n = new Array(t), r = 0; r < t; r++)n[r] = arguments[r]; if (!n.length) return a; if ("setGdprApplies" === n[0]) n.length > 3 && 2 === parseInt(n[1], 10) && "boolean" == typeof n[3] && (e = n[3], "function" == typeof n[2] && n[2]("set", !0)); else if ("ping" === n[0]) { var i = { gdprApplies: e, cmpLoaded: !1, cmpStatus: "stub" }; "function" == typeof n[2] && n[2](i) } else a.push(n) }, n.addEventListener("message", (function (e) { var t = "string" == typeof e.data, a = {}; try { a = t ? JSON.parse(e.data) : e.data } catch (e) { } var n = a.__tcfapiCall; n && window.__tcfapi(n.command, n.version, (function (a, r) { var i = { __tcfapiReturn: { returnValue: a, success: r, callId: n.callId } }; t && (i = JSON.stringify(i)), e.source.postMessage(i, "*") }), n.parameter) }), !1)) }; "undefined" != typeof module ? module.exports = e : e() }();
</script>
<script>
    window._sp_ = {
        config: {
            accountId: 270,
            wrapperAPIOrigin: "https://wrapper-api.sp-prod.net/tcfv2",
            // this domain could be a subdomain if a proper CNAME is given
            mmsDomain: "https://message.sp-prod.net"
        }
    }
</script>
<script async src="https://gdpr-tcfv2.sp-prod.net/wrapperMessagingWithoutDetection.js"></script>
```

This **must** be loaded **before** the ad tag. So ideally this is put into the `<head>` tag.