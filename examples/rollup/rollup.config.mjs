import typescript from '@rollup/plugin-typescript';
import html, { makeHtmlAttributes } from "@rollup/plugin-html";
import terser from "@rollup/plugin-terser";
import serve from 'rollup-plugin-serve';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy'


const isProduction = process.env.BUILD_TARGET === 'production';

console.log('isProduction:', isProduction);

const htmlPlugin = html({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width' }
  ],
  template: ({attributes, meta, files, publicPath, title}) => {
    // copied from the default template and added files.mjs
    // https://github.com/rollup/plugins/blob/master/packages/html/src/index.ts
    const scripts = [ ...(files.js || []), ...(files.mjs || []) ]
      .map(({fileName}) => {
        const attrs = makeHtmlAttributes(attributes.script);

        // Adding data attributes to the script tag for the configFromEndpoint implementation
        return `<script id="moli-ad-tag" src="${publicPath}${fileName}"${attrs} data-version="prod" data-pub-code="foo" data-endpoint="localhost:8000"></script>`;
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
        [ htmlPlugin,
          copy({
            targets: [
              { src: 'prod.json', dest: 'dist/foo' },
            ]
          }),
          serve({contentBase: 'dist', port: 8000,})
        ]
    )
  ]
};
