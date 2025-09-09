import * as esbuild from 'esbuild';

// parse command that should be run
const [ _node, _script ,cmd ] = process.argv;

// target browsers for esbuild output
const target = [
  'es2020',
  'chrome58',
  'firefox57',
  'safari11',
  'edge18'
];

const context = await esbuild.context({
  entryPoints: [ 'index.ts' ],
  bundle: true,
  minify: false,
  sourcemap: true,
  target: target,
  outfile: 'www/moli.mjs',
});

// execute the command from the command line
switch (cmd) {
  case 'build':
    await esbuild.build({
      entryPoints: [ 'index.ts' ],
      bundle: true,
      minify: true,
      target: target,
      outfile: 'dist/moli.mjs',
    });
    await context.dispose();
    break
  case 'watch':
    await context.watch();
    break;
  case 'serve':
    // see https://esbuild.github.io/api/#serve-arguments
    const server = await context.serve({
      servedir: 'www',
    });
    console.log('Serving on:', server.host, server.port);
    break;
  default:
    console.error('Unknown command:', cmd);
    console.error('Use one of: build, watch, serve');
    await context.dispose();
    break;
}
