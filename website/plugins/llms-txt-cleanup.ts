/**
 * Rehype/remark plugins for `@signalwire/docusaurus-plugin-llms-txt`.
 *
 * The llms-txt plugin converts the rendered HTML of each doc page into markdown. A few Docusaurus
 * rendering artifacts don't convert cleanly, so `rehypeLlmsCleanup` normalizes the HTML first:
 *
 * - removes the heading anchor links (`[​](#overview "Direct link to Overview")`)
 * - copies the code language from `<pre class="language-xyz">` onto the `<code>` element, so fenced
 *   code blocks keep their language
 * - turns admonitions (`:::tip`, `:::caution`, ...) into blockquotes with a bold label
 *
 * `remarkLlmsFixLinks` runs on the markdown AST after the llms-txt link rewriting and fixes two issues:
 * - the plugin prepends the full site URL (which already contains the baseUrl) to internal links that
 *   contain the baseUrl as well: `https://highfivve.github.io/moli-ad-tag/moli-ad-tag/...`
 * - links with a trailing slash (typedoc generates those) become `.../moli/.md` instead of `.../moli.md`
 */

type Properties = Record<string, unknown>;

interface Element {
  type: 'element';
  tagName: string;
  properties?: Properties;
  children: Node[];
}

interface Text {
  type: 'text';
  value: string;
}

type Node = Element | Text | { type: string; children?: Node[] };

const isElement = (node: Node): node is Element => node.type === 'element';

const classNames = (node: Element): string[] => {
  const className = node.properties?.className;
  return Array.isArray(className)
    ? className.map(String)
    : typeof className === 'string'
      ? className.split(' ')
      : [];
};

const hasClass = (node: Element, name: string): boolean => classNames(node).includes(name);

const hasClassPrefix = (node: Element, prefix: string): boolean =>
  classNames(node).some(c => c.startsWith(prefix));

const textContent = (node: Node): string =>
  node.type === 'text'
    ? (node as Text).value
    : 'children' in node && node.children
      ? node.children.map(textContent).join('')
      : '';

const languageOf = (node: Element): string | undefined =>
  classNames(node).find(c => c.startsWith('language-'));

const transformAdmonition = (node: Element): void => {
  const heading = node.children.find(c => isElement(c) && hasClassPrefix(c, 'admonitionHeading'));
  const content = node.children.find(c => isElement(c) && hasClassPrefix(c, 'admonitionContent'));
  const label = heading ? textContent(heading).trim() : '';
  node.tagName = 'blockquote';
  node.properties = {};
  node.children = [
    ...(label
      ? [
          {
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'strong',
                properties: {},
                children: [{ type: 'text', value: label.charAt(0).toUpperCase() + label.slice(1) }]
              } satisfies Element
            ]
          } satisfies Element
        ]
      : []),
    ...(content && isElement(content) ? content.children : [])
  ];
};

const cleanup = (parent: Node): void => {
  if (!('children' in parent) || !parent.children) {
    return;
  }
  parent.children = parent.children.filter(
    child => !(isElement(child) && hasClass(child, 'hash-link'))
  );

  for (const child of parent.children) {
    if (!isElement(child)) {
      cleanup(child);
      continue;
    }
    if (hasClass(child, 'theme-admonition')) {
      transformAdmonition(child);
    }
    if (child.tagName === 'pre') {
      const language = languageOf(child);
      const code = child.children.find(c => isElement(c) && c.tagName === 'code');
      if (language && code && isElement(code) && !languageOf(code)) {
        code.properties = { ...code.properties, className: [...classNames(code), language] };
      }
    }
    cleanup(child);
  }
};

const fixLinks = (parent: Node, siteUrl: string, duplicated: string): void => {
  if (!('children' in parent) || !parent.children) {
    return;
  }
  for (const child of parent.children) {
    if (
      (child.type === 'link' || child.type === 'definition') &&
      'url' in child &&
      typeof child.url === 'string'
    ) {
      let url = child.url;
      if (url.startsWith(duplicated)) {
        url = siteUrl + url.slice(duplicated.length);
      }
      if (url.startsWith(siteUrl)) {
        url = url.replace(/\/\.md(?=$|[?#])/, '.md');
      }
      (child as { url: string }).url = url;
    }
    fixLinks(child, siteUrl, duplicated);
  }
};

/** Normalizes Docusaurus HTML before the llms-txt plugin converts it to markdown. */
export const rehypeLlmsCleanup =
  () =>
  (tree: Node): void =>
    cleanup(tree);

/**
 * @param url the docusaurus `url`, e.g. `https://highfivve.github.io`
 * @param baseUrl the docusaurus `baseUrl`, with leading and trailing slash, e.g. `/moli-ad-tag/`
 */
export const remarkLlmsFixLinks = ({ url, baseUrl }: { url: string; baseUrl: string }) => {
  const siteUrl = url + baseUrl;
  const duplicated = siteUrl + baseUrl.slice(1);
  return () =>
    (tree: Node): void =>
      fixLinks(tree, siteUrl, duplicated);
};
