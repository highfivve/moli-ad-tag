---
title: Introduction
---

Moli is an ad tag library that helps you to build your own ad setup.
It's built from publishers for publishers. Checkout the [5-minute setup guide](getting-started/quick-start)
to get a glance on how things work.

## Features

This section highlights some of Moli's features.

* Google Ad Manager integration
* [Prebid integration](features/prebid)
* [Amazon TAM integration](features/tam)
* [Responsive size configuration](features/size-config)
* [Module system](modules/index)
* [TCF 2 integration](features/consent)
* [Rich debugging console](features/debugging)


## Requirements

In order to run Moli your ad stack must meet the following requirements

* TCF 2 CMP on your page. Moli expects a working `__tcfapi` implementation
* Google Ad Manager as an ad manager. There is no support for Xandr, Freewheel or any other
  ad server yet


## How does it work?

This section should give you a brief understanding of how an integration of moli may look
at your site.

Moli lets you define your ad setup in a declarative manner. You define `slots` in your ad
tag that map to a specific slot on your page. The mapping is done _exclusively_ via `dom ids`.
DOM ids are unique and easy to identify. Most linting tools warn you if there are elements with
the same id.

Most modern pages have a responsive design. This means the same ad slot is available on all
screen sizes. Moli gives you various options to specify if and with what sizes and ad slot should
be mattered based on _media queries_ and _labels_ that can be defined anywhere.

Defining your ad setup is the crucial part. From there on you setup a javascript project the
way you want, add moli as an npm dependency, intialize the ad tag as described [in the setup guide](getting-started/quick-start)
deploy the javascript bundle somewhere public and integrated it on your page.
