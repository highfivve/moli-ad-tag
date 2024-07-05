/*
 * This script creates a bundle from the given modules.json file and the given output file.
 * It will do this by
 *
 * 1. Reading the modules.json file
 * 2. Ordering the modules based on their dependencies
 *    1. The `bundle/init` module is always first and is added automatically
 *    2. The `bundle/configureFromEndpoint` module is always last
 * 3. Generates an entrypoint file that imports all the modules in the correct order
 * 4. Bundles the entrypoint file using rollup
 */

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import * as esbuild from 'esbuild';
import packageJson from './package.json';

type OptionsValues = {
  /**
   * a list of modules to be build. `modules` or `config` must be specified.
   */
  readonly modules: string[];

  /**
   * the output file of the bundle, e.g. 'dist/bundle.js'
   */
  readonly output: string;

  /**
   * the config file containing the modules that should be part of the bundle.
   * Shape of the config must be of type `BundleConfig`.
   *
   * Value is optional if `modules` is specified.
   */
  readonly config?: string;

  /**
   * @see https://esbuild.github.io/api/#target for possible values
   */
  readonly target: string[];

  /**
   * the format of the output file. Will be passed to rollup to override the default
   */
  readonly format: 'esm' | 'iife' | 'cjs';
};

type BundleConfig = {
  /**
   * a description of the bundle
   */
  description?: string;

  /**
   * contains bundle modules that should be part of the bundle.
   */
  modules: string[];
};

const command = program
  .name('bundler')
  .description('Create a bundle from the given modules.json file and the given output file')
  .version('1.0.0')
  .option(
    '-f, --format <format>',
    'the format of the output file. Will be passed to esbuild to override the default (esm). Allowed values are esm, iife, cjs',
    'esm'
  )
  .option(
    '-m, --modules [modules...]',
    'a list of modules that should be part of the ad tag bundle. The order of the modules is important. The `bundle/configureFromEndpoint` module must always be last. The config option will be ignored if modules are specified'
  )
  .option(
    '-c, --config <config>',
    'file containing the modules that should be part of the ad tag bundle',
    value => path.join(__dirname, value)
  )
  .option(
    '-t, --target [target...]',
    'the target of the output file. Will be passed to esbuild to override the default (es6).',
    ['es6']
  )
  .option('-o, --output <output>', 'the output file of the bundle', 'dist/bundle.js')
  .option(
    '--failAfterWarnings <value>',
    'if set, rollup will fail if there are any warnings',
    value => value === 'true',
    true
  )
  .parse(process.argv);

// parse modules.json
const options = command.opts<OptionsValues>();

const loadConfigFile = (): BundleConfig | null => {
  if (options.config) {
    if (fs.existsSync(options.config)) {
      return JSON.parse(fs.readFileSync(options.config, 'utf-8')) as BundleConfig;
    } else {
      program.error(`Config file does not exist: ${options.config}`);
    }
  }
  return null;
};

const buildBundleConfig = (): BundleConfig => {
  const bundleConfig: BundleConfig = {
    modules: ['init']
  };

  const bundleConfigFromFile = loadConfigFile();

  // append modules from cli or config file
  if (options.modules) {
    console.log(`Appending ${options.modules.length} modules to the bundle from cli param`);
    bundleConfig.modules.push(...options.modules);
  } else if (bundleConfigFromFile) {
    console.log(
      `Appending ${bundleConfigFromFile.modules.length} modules to the bundle from config`
    );
    bundleConfig.modules.push(...bundleConfigFromFile.modules);
    bundleConfig.description = bundleConfigFromFile.description;
  } else {
    program.error('No modules or config file specified');
  }
  return bundleConfig;
};

const bundleConfig = buildBundleConfig();

if (bundleConfig.description) {
  console.log('Bundle description:', bundleConfig.description);
}
console.log('Selected modules:', bundleConfig.modules.join(', '));
console.log('Moli Library Version:', packageJson.version);

const moduleImports = bundleConfig.modules.map(module => `import './${module}';`).join('\n');
const entrypointName = options.output.replace('js$', 'ts$').split('/').pop();

if (!entrypointName) {
  program.error(`Could not figure out entrypoint name from output file: ${options.output}`);
}

// generate entrypoint file
const entrypoint = path.join(__dirname, 'ad-tag', 'source', 'ts', 'bundle', entrypointName);
console.log('Generated entrypoint file:', entrypoint);
fs.writeFileSync(entrypoint, ['// modules', moduleImports].join('\n'));

try {
  // cleanup previous bundles
  fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });

  esbuild.buildSync({
    entryPoints: [entrypoint],
    tsconfig: 'tsconfig.build.json',
    bundle: true,
    minify: true,
    target: options.target,
    outfile: options.output,
    format: options.format,
    platform: 'browser',
    banner: {
      js: `/* ad tag library ${packageJson.version} by highfivve.com */`
    }
  });
} finally {
  // cleanup
  fs.rmSync(entrypoint, { force: true });
}
