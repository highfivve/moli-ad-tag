import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import external from 'rollup-plugin-peer-deps-external';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import replace from '@rollup/plugin-replace';

const isProduction = process.env.NODE_ENV === 'production';

console.log('is production', isProduction);

/**
 * Why do we have a different bundler for the moli console?
 * Well, esbuild generates properly minified code with all classes and functions minified, which rollup and terser
 * somehow cannot do.
 *
 * What esbuild is not capable of is to inject the CSS into the JS file, so we need to use rollup for that.
 * There are some and unmaintained plugins for esbuild that may be able to do that, but they are barely used.
 * ESBuild's take on this is to load the CSS from somewhere else. Sure, we could do that, but that means a separate
 * file and url that we need to manage.
 *
 * @type {import('rollup').RollupOptions}
 */
export default [
  {
    input: 'ad-tag/source/ts/console/debug.tsx',
    output: [
      {
        file: 'dist/console.js',
        format: 'iife',
        sourcemap: false
      },
      {
        file: 'dist/console.mjs',
        format: 'es',
        exports: 'named',
        sourcemap: false
      },
      // for the examples
      {
        file: 'examples/esbuild/www/console.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/examples/esbuild/www/console.mjs',
        format: 'es',
        exports: 'named',
        sourcemap: true
      }
    ],
    plugins: [
      external(),
      nodeResolve({
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.css']
      }),
      commonjs(),
      typescript({ tsconfig: 'tsconfig.build.json' }),
      postcss({
        extract: false,
        config: {
          path: 'postcss.config.js'
        }
      }),
      // react uses this variable to determine if it should be in dev mode, so we need to replace it
      replace({
        preventAssignment: false,
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      }),
      ...(isProduction ? [terser()] : [])
    ]
  }
];
