import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'The Publisher Ad Tag',
  tagline: 'An open ad tag for publishers',
  url: 'https://highfivve.github.io',
  baseUrl: '/moli-ad-tag/',
  onBrokenLinks: 'warn', // this failed on jenkins. remove once github pages works
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'highfivve', // Usually your GitHub org/user name.
  projectName: 'the publisher ad tag', // Usually your repo name.

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          routeBasePath: '/docs',
          // Please change this to your repo.
          editUrl: 'https://github.com/highfivve/moli-ad-tag'
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    // colorMode: {
    //   defaultMode: 'light',
    //   disableSwitch: false,
    //   respectPrefersColorScheme: true
    // },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    },
    navbar: {
      title: 'The Publisher Ad Tag',
      logo: {
        alt: 'Highfivve Logo',
        src: 'img/highfivve_circle.png'
      },
      items: [
        {
          to: 'docs/home',
          label: 'Docs',
          position: 'left'
        },
        {
          to: 'docs/api',
          label: 'API',
          position: 'left'
        },
        {
          to: 'docs/modules',
          label: 'Modules',
          position: 'left'
        },
        {
          href: 'https://github.com/highfivve/moli-ad-tag',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: 'docs/'
            },
            {
              label: 'API',
              to: 'docs/api'
            }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/moli-ad-tag'
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/gutefrageIT'
            }
          ]
        },
        {
          title: 'Company',
          items: [
            {
              label: 'Highfivve',
              to: 'https://highfivve.com'
            },
            {
              label: 'GitHub',
              href: 'https://github.com/highfivve/moli-ad-tag'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Highfivve, Inc. Built with Docusaurus.`
    }
  } satisfies Preset.ThemeConfig,

  plugins: [
    // Typedoc configuration
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'ad-tag',
        entryPoints: [
          '../ad-tag/source/ts/ads/moli.ts',
          '../ad-tag/source/ts/types/moliConfig.ts',
          '../ad-tag/source/ts/types/moliRuntime.ts',
          '../ad-tag/source/ts/types/prebidjs.ts'
        ],
        tsconfig: '../tsconfig.json',
        out: 'docs/api',
        readme: 'none',
        cleanOutputDir: true,
        disableSources: true,
        excludeInternal: true,
        outputFileStrategy: 'members'
      }
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'modules',
        name: 'Modules',
        entryPoints: [
          '../ad-tag/source/ts/ads/modules/ad-reload/index.ts',
          '../ad-tag/source/ts/ads/modules/adex/index.ts',
          '../ad-tag/source/ts/ads/modules/blocklist-url/index.ts',
          '../ad-tag/source/ts/ads/modules/bridge/index.ts',
          '../ad-tag/source/ts/ads/modules/cleanup/index.ts',
          '../ad-tag/source/ts/ads/modules/confiant/index.ts',
          '../ad-tag/source/ts/ads/modules/custom/index.ts',
          '../ad-tag/source/ts/ads/modules/emetriq/index.ts',
          '../ad-tag/source/ts/ads/modules/generic-skin/index.ts',
          '../ad-tag/source/ts/ads/modules/geoedge/index.ts',
          '../ad-tag/source/ts/ads/modules/identitylink/index.ts',
          '../ad-tag/source/ts/ads/modules/interstitial/index.ts',
          '../ad-tag/source/ts/ads/modules/lazy-load/index.ts',
          '../ad-tag/source/ts/ads/modules/prebid-first-party-data/index.ts',
          '../ad-tag/source/ts/ads/modules/pubstack/index.ts',
          '../ad-tag/source/ts/ads/modules/sticky-footer-ad/index.ts',
          '../ad-tag/source/ts/ads/modules/sticky-footer-ad-v2/index.ts',
          '../ad-tag/source/ts/ads/modules/sticky-header-ad/index.ts',
          '../ad-tag/source/ts/ads/modules/utiq/index.ts',
          '../ad-tag/source/ts/ads/modules/yield-optimization/index.ts',
          '../ad-tag/source/ts/ads/modules/zeotap/index.ts'
        ],
        exclude: ['**/node_modules/**', 'modules/**/*.test.ts', 'README.md'],
        tsconfig: '../tsconfig.json',
        out: 'docs/modules',
        readme: 'none',
        cleanOutputDir: true,
        disableSources: true,
        excludeInternal: true,
        outputFileStrategy: 'modules'
      }
    ]
  ]
};

export default config;
