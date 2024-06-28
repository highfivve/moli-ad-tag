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
import { execSync } from 'node:child_process';

type OptionsValues = {
  /**
   * a list of modules to be build
   */
  readonly modules: string[];
  readonly output: string;
  readonly config?: string;
  readonly failAfterWarnings: boolean;

  /**
   * the format of the output file. Will be passed to rollup to override the default
   */
  readonly format: 'es' | 'iife'
};

type BundleConfig = {
  /**
   * contains bundle modules that should be part of the bundle.
   */
  readonly modules: string[];
};

const command = program
  .name('bundler')
  .description('Create a bundle from the given modules.json file and the given output file')
  .version('1.0.0')
  .requiredOption('-o, --output <output>', 'output file')
  .option('-m, --modules [...modules]', 'a list of modules that should be part of the ad tag bundle. The order of the modules is important. The `bundle/configureFromEndpoint` module must always be last. The config option will be ignored if modules are specified')
  .option(
    '-c, --config <config>',
    'file containing the modules that should be part of the ad tag bundle',
    value => path.join(__dirname, value)
  )
  .option(
    '--failAfterWarnings <value>',
    'if set, rollup will fail if there are any warnings',
    value => value === 'true',
    true
  )
  .option('-f, --format <format>', 'the format of the output file. Will be passed to rollup to override the default', 'es')
  .parse(process.argv);

// parse modules.json
const options = command.opts<OptionsValues>();

const selectedModules = (): string[] => {
  if(options.modules && options.modules.length > 0) {
    return options.modules;
  } else if (options.config) {
    if(fs.existsSync(options.config)) {
      const config = JSON.parse(fs.readFileSync(options.config, 'utf-8')) as BundleConfig;
      return config.modules;
    }
    program.error(`Config file does not exist: ${options.config}`);
  }

  program.error('No modules or config file specified');
}

const modules = ['init', selectedModules()];

console.log('Selected modules:', modules);
console.log('Building format', options.format);

// generate entrypoint file
const entrypoint = path.join(__dirname, 'ad-tag', 'source', 'ts', 'bundle', 'bundle.ts');
fs.writeFileSync(entrypoint, modules.map(module => `import './${module}';`).join('\n'));

try {
  const cmd: string[] = [
    'npx',
    'rollup',
    entrypoint,
    '--file',
    options.output,
    '-c',
    '--format',
    options.format,
    ...(options.failAfterWarnings ? ['--failAfterWarnings'] : [])
  ];
  // bundle entrypoint file
  execSync(cmd.join(' '), {
    stdio: 'inherit'
  });
} finally {
  // cleanup
  fs.rmSync(entrypoint, { force: true });
}
