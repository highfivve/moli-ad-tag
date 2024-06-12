import typescript from '@rollup/plugin-typescript';
import html, { makeHtmlAttributes } from "@rollup/plugin-html";
import terser from "@rollup/plugin-terser";
import serve from 'rollup-plugin-serve';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const isProduction = process.env.BUILD_TARGET === 'production';

console.log('isProduction:', isProduction);

const htmlPlugin = html({
  template: ({attributes, meta, files, publicPath, title}) => {
    // copied from the default template and added files.mjs
    // https://github.com/rollup/plugins/blob/master/packages/html/src/index.ts
    const scripts = [ ...(files.js || []), ...(files.mjs || []) ]
      .map(({fileName}) => {
        const attrs = makeHtmlAttributes(attributes.script);
        return `<script src="${publicPath}${fileName}"${attrs}></script>`;
      })
      .join('\n');

    const links = (files.css || [])
      .map(({fileName}) => {
        const attrs = makeHtmlAttributes(attributes.link);
        return `<link href="${publicPath}${fileName}" rel="stylesheet"${attrs}>`;
      })
      .join('\n');

    const metas = meta
      .map((input) => {
        const attrs = makeHtmlAttributes(input);
        return `<meta${attrs}>`;
      })
      .join('\n');

    return `<!doctype html>
<html${makeHtmlAttributes(attributes.html)}>
  <head>
    ${metas}
    <title>${title}</title>
    ${links}
  </head>
  <body>
    <h2>Ad Slot</h2>
    <div id="content_1"></div>
    ${scripts}
  </body>
</html>`;
  }
});

export default {
  input: 'index.ts',
  output: {
    file: 'dist/moli.mjs',
    format: 'es'
  },
  plugins: [ nodeResolve(), typescript(),
    ...(isProduction ?
        [ terser() ] :
        [ htmlPlugin, serve({contentBase: 'dist', port: 8000,}) ]
    )
  ]
};
