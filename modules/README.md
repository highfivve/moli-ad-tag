# Modules

Started in [GD-1464](https://jira.gutefrage.net/browse/GD-1464)

This directory contains 3rd party integration. We call each integration a module
that can be integrated separately for each publisher.

## Usage

Modules follow the same pattern. In the publisher ad tag

1. import the required module. This allows webpack to treeshake all other modules that are not imported
2. create an instance of that module

