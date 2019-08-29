export const confiantPrebid = () => {
    window.pbjs = window.pbjs || {que: []};

    // Wrapper for highfivve GmbH, generated on 2019-08-07T15:27:05-04:00, version 2018.04.02
    window.pbjs.que.push(function () {

        // keep a reference to original renderAd function
        var w = window;
        w._clrm = w._clrm || {};
        w._clrm.renderAd = w._clrm.renderAd || pbjs.renderAd;
        var config = w._clrm.prebid || {
            /* Enables sandboxing on a device group
                 All:1 , Desktop:2, Mobile: 3, iOS: 4, Android: 5, Off: 0
             */
            sandbox: 0
        };

        if (w.confiant && w.confiant.settings) {
            config = w.confiant.settings;
        }

        var confiantWrap = function confiantWrap(a, b, c, d, e) {
            function f(a) {
                return (m(a) || "")[s]("/", "_")[s]("+", "-")
            }

            function g(b, c, d) {
                var e = w + n(b) + "&d=" + c, f = "err__" + 1 * new Date;
                k[f] = d;
                var g = "<" + q + " on" + t + '="void(' + f + '())" ' + r + '="' + e + '" type="text/java' + q + '" ></' + q + ">";
                a[v](g)
            }

            function h() {
                var c = f(d + "/" + x.k.hb_bidder[0] + ":" + x.k.hb_size[0]), h = {wh: c, wd: l.parse(l[u](x)), wr: 0};
                g(c, f(l[u](h)), function () {
                    a[v](b.ad)
                });
                var i = {prebid: {adId: b.adId, cpm: b.cpm}}, j = {d: h, t: b.ad, cb: e, id: i};
                k[d] = {}, k[d][c] = j
            }

            var i = b.bidder, j = b.size, k = a.parentWindow || a.defaultView, l = k.JSON, m = k.btoa,
                n = k.encodeURIComponent;
            if (!l || !m) return !1;
            var o = "t", p = "i", q = "script", r = "src", s = "replace", t = "error", u = "stringify",
                v = "wr" + p + o + "e", w = "https://" + c + "/?wrapper=" + n(d) + "&tpid=",
                x = {k: {hb_bidder: [i], hb_size: [j]}};
            return h(), a.close(), !0
        };
        //add optional blocking layer

        var isGoogleFrame = function (c) {
            return c.tagName === 'IFRAME' && c.id && c.id.indexOf('google_ads_iframe_') > -1;
        };

        var shouldSandbox = function () {
            var uaToRegexMap = {
                    "mobile": /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/i,
                    "ios": /(.+)(iPhone|iPad|iPod)(.+)OS[\s|\_](\d)\_?(\d)?[\_]?(\d)?.+/i,
                    "android": /Android/i
                },
                sbStr = "" + config.sandbox;
            if (sbStr === "1") {
                // all environments
                return true;
            } else if (sbStr === "2") {
                // desktop
                return !navigator.userAgent.match(uaToRegexMap["mobile"]);
            } else if (sbStr === "3") {
                // mobile
                return navigator.userAgent.match(uaToRegexMap["mobile"]);
            } else if (sbStr === "4") {
                // ios only
                return navigator.userAgent.match(uaToRegexMap["ios"]);
            } else if (sbStr === "5") {
                // android
                return navigator.userAgent.match(uaToRegexMap["android"]);
            } else {
                return false;
            }
        };

        Node.prototype.appendChild = (function (original) {
            return function (child) {
                if (isGoogleFrame(child) && shouldSandbox() && !child.getAttribute('sandbox')) {
                    child.setAttribute('sandbox', 'allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation');
                    child.setAttribute('data-forced-sandbox', true);
                }
                return original.call(this, child);
            };
        }(Node.prototype.appendChild));


        // override renderAd
        pbjs.renderAd = function (doc, id) {
            if (doc && id) {
                try {

                    // get pbjs bids
                    var bids = [],
                        bidResponses = pbjs.getBidResponses(),
                        highestBids = pbjs.getHighestCpmBids();
                    for (var slot in bidResponses) {
                        bids = bids.concat(bidResponses[slot].bids);
                    }
                    bids = bids.concat(highestBids);

                    // lookup ad by ad Id (avoid ES6 array functions)
                    var bid, i;
                    for (i = 0; i < bids.length; i++) {
                        if (bids[i].adId === id) {
                            bid = bids[i];
                            break;
                        }
                    }

                    // Optional: list of bidders that don't need wrapping, array of strings, e.g.: ["bidder1", "bidder2"]
                    var confiantExcludeBidders = config.excludeBidders || [];

                    // check bidder exclusion (avoid ES6 array functions)
                    if (bid) {
                        var excludeBidder = false;
                        for (i = 0; i < confiantExcludeBidders.length; i++) {
                            if (bid.bidder === confiantExcludeBidders[i]) {
                                excludeBidder = true;
                                break;
                            }
                        }
                    }


                    if (bid && bid.ad && !excludeBidder) {
                        // Neutralize document
                        var docwrite = doc.write;
                        var docclose = doc.close;
                        doc.write = doc.close = function () {
                        };
                        // call renderAd with our neutralized doc.write
                        window._clrm.renderAd(doc, id);
                        // Restore document
                        delete doc.write;
                        delete doc.close;

                        var serializedCasprLayer = (function () {
                            if (typeof getSerializedCaspr === 'undefined') {
                                //for now both builds are supported v2(additional network call) and v3 (unified)
                                return null;
                            }
                            return getSerializedCaspr();
                        })();

                        // do the actual ad serving and fall back on document.write if failure
                        if (!confiantWrap(doc, bid, 'clarium.global.ssl.fastly.net', 'Fhkh8X7bib_CoPkwt4wiIcaO-vk', callback, serializedCasprLayer, config.devMode)) {
                            doc.write(bid.ad);
                            doc.close();
                        }

                        return;
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            // if bid.ad is not defined or if any error occurs, call renderAd to serve the creative
            window._clrm.renderAd(doc, id);
        };

    });
};