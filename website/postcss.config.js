/**
 * IMPORTANT: this empty configuration is necessary so the postcss loader doesn't find the
 *            config file in the root folder, which causes all css processing to fail and the site
 *            looks like shit
 * @type {import('postcss-load-config').Config} */
const config = {
  plugins: []
};

module.exports = config;
