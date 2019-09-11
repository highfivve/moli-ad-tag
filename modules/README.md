# Modules

Started in [GD-1464](https://jira.gutefrage.net/browse/GD-1464)

This directory contains 3rd party integration. We call each integration a module
that can be integrated separately for each publisher.

## Usage

Modules follow the same pattern. In the publisher ad tag

1. import the required module. This allows webpack to treeshake all other modules that are not imported
2. create an instance of that module

## Implement a module

You can implement a module by reusing one of the existing modules. Modules are automatically part of the
yarn workspace as `modules/*` is used as a workspace glob pattern. Things that are important

1. You should only have a single `index.ts` file that contains everything
2. Your `package.json` must contain a `validate` and `validate:jenkins` script
3. The module needs to be added in the [Jenkinsfile](../Jenkinsfile) in the `stage('Modules')`
