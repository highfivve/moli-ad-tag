// workaround dirName setting absolute instead of relativ paths
const moduleSidebar = require('./modules-typedoc-sidebar')[0];
moduleSidebar.dirName = 'modules';

// only generate a sidebar
const modulesOnlySidebar = { ...moduleSidebar, dirName: 'modules/modules' };

const apiSidebar = require('./ad-tag-typedoc-sidebar');
apiSidebar[0].dirName = 'api';

module.exports = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Getting started',
      items: [
        'getting-started/quick-start',
        'getting-started/adtag-build',
        'getting-started/ad-slot-configuration',
        'getting-started/glossary'
      ],
      collapsed: false
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'features/size-config',
        'features/prebid',
        'features/tam',
        'features/consent',
        'features/targeting',
        'features/labels',
        'features/buckets',
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
      items: [modulesOnlySidebar],
      collapsed: true
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/conditional-ad-slots',
        'guides/immutable-ad-tags',
        'guides/logging',
        'guides/styleguide'
      ],
      collapsed: false
    }
  ],
  API: apiSidebar,
  Modules: [moduleSidebar]
};
