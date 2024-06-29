import typescript from '@rollup/plugin-typescript';
import terser from "@rollup/plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';

// input and output are passed from the command line
export default {
  output: [
    {
      file: 'dist/bundle.mjs',
      format: 'es',
    },
    {
      file: 'dist/bundle.es5.js',
      format: 'iife'
    }
  ],
  plugins: [
    nodeResolve({browser: true}),
    typescript({tsconfig: 'tsconfig.build.json'}),
    terser() ]
};
