import typescript from '@rollup/plugin-typescript';
import terser from "@rollup/plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import path from "path";

// input and output are passed from the command line
export default {
  output: [
    {
      file: 'dist/bundle.mjs',
      format: 'es',
      plugins: [
        getBabelOutputPlugin({
          allowAllFormats: true,
          configFile: path.resolve('./babel.es6.config.json')
        }),
        terser()
      ]
    },
    {
      file: 'dist/bundle.es5.js',
      format: 'iife',
      plugins: [
        getBabelOutputPlugin({
          allowAllFormats: true,
          configFile: path.resolve('./babel.es5.config.json')
        }),
        terser()
      ]
    }
  ],
  plugins: [
    nodeResolve({browser: true}),
    typescript({tsconfig: 'tsconfig.build.json'}),
    terser() ]
};
