import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import external from 'rollup-plugin-peer-deps-external';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import replace from '@rollup/plugin-replace';


// input and output are passed from the command line
export default [
  {
    input: 'ad-tag/source/ts/console/debug.tsx',
    output: [
      {
        file: 'dist/console.js',
        format: 'cjs',
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
      typescript({tsconfig: 'tsconfig.build.json'}),
      postcss({
        extract: false,
        config: {
          path: 'postcss.config.js'
        }
      }),
      replace({
        preventAssignment: false,
        'process.env.NODE_ENV': JSON.stringify( 'production' )
      }),
      // terser()
    ]
  }
]
