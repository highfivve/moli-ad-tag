const modulesSidebarItem = require('./modules-typedoc-sidebar').find(
  item => typeof item === 'object' && item.label === 'Modules'
).items;

module.exports = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Getting started',
      items: [
        'getting-started/quick-start',
        'getting-started/adtag-build',
        'getting-started/ad-slot-configuration'
      ],
      collapsed: false
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/adslots',
        'features/prebid',
        'features/tam',
        'features/consent',
        'features/targeting',
        'features/responsive-ads',
        'features/debugging',
        'features/logger',
        'features/environments',
        'features/reporting',
        'features/passback'
      ],
      collapsed: false
    },
    {
      type: 'category',
      label: 'Modules',
      items: modulesSidebarItem,
      collapsed: true
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/conditional-ad-slots', 'guides/immutable-ad-tags', 'guides/logging'],
      collapsed: false
    }
  ],
  API: require('./ad-tag-typedoc-sidebar'),
  Modules: require('./modules-typedoc-sidebar')
};
