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

    <!-- CMP -->
    <!-- Test mode works without a CMP -->

    <script type="module" async="async" src="https://cdn.h5v.eu/adtag/v5.0.3/all.mjs"></script>

    <!-- configure slots and request ads -->
    <script>
        // setup the command queue
        window.moli = window.moli || {que: []};

        // push callbacks into the queue
        window.moli.que.push(function(adTag) {

            // on the fly configuration
            adTag.configure({
                environment: 'test',
                requestAds: true,
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
