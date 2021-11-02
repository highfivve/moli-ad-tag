module.exports = {
  title: 'The Publisher Ad Tag',
  tagline: 'An open ad tag for publishers',
  url: 'https://highfivve.github.io',
  baseUrl: '/moli-ad-tag/',
  onBrokenLinks: 'warn', // this failed on jenkins. remove once github pages works
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'highfivve', // Usually your GitHub org/user name.
  projectName: 'the publisher ad tag', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'The Publisher Ad Tag',
      logo: {
        alt: 'Highfivve Logo',
        src: 'img/highfivve_circle.png'
      },
      items: [
        {
          to: 'docs/',
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
        { to: 'blog', label: 'Blog', position: 'left' },
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
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/highfivve/moli-ad-tag'
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl: 'https://github.com/highfivve/moli-ad-tag'
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      }
    ]
  ],
  plugins: [
    // Typedoc configuration
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'ad-tag',
        entryPoints: ['../ad-tag/source/ts/index.ts'],
        tsconfig: '../ad-tag/tsconfig.json',
        out: 'api',
        disableSources: true,
        excludeInternal: true,
        sidebar: {
          sidebarFile: 'ad-tag-typedoc-sidebar.js'
        }
      }
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'modules',
        name: 'Modules',
        entryPoints: [
          '../modules/ad-reload/index.ts',
          '../modules/adex/index.ts',
          '../modules/blocklist-urls/index.ts',
          '../modules/confiant/index.ts',
          '../modules/generic-skin/index.ts',
          '../modules/identitylink/index.ts',
          '../modules/identitylink/types/identitylink.d.ts',
          '../modules/prebid-google-analytics/index.ts',
          '../modules/prebid-first-party-data/index.ts',
          '../modules/pubstack/index.ts',
          '../modules/sovrn-ad-reload/index.ts',
          '../modules/yield-optimization/index.ts',
          '../modules/zeotap/zeotap.ts'
        ],
        exclude: ['**/node_modules/**', 'modules/**/*.test.ts'],
        tsconfig: '../modules/tsconfig.docs.json',
        out: 'modules',
        disableSources: true,
        excludeInternal: true,
        sidebar: {
          categoryLabel: 'Modules',
          sidebarFile: 'modules-typedoc-sidebar.js'
        }
      }
    ]
  ]
};
