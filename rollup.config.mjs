import typescript from '@rollup/plugin-typescript';
import terser from "@rollup/plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';

// input and output are passed from the command line
export default {
  output: {
    format: 'es'
  },
  plugins: [ nodeResolve(), typescript({
    tsconfig: 'tsconfig.build.json',
  }), terser() ]
};
