const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');

const baseConfig = getDefaultConfig(__dirname);

// `@react-native/metro-config` >= 0.85 returns `resolver.blockList` as a
// single RegExp, but `react-native-monorepo-config` expects an iterable.
// Normalize before handing it off so the helper can spread it.
if (baseConfig.resolver && baseConfig.resolver.blockList != null) {
  baseConfig.resolver.blockList = [].concat(baseConfig.resolver.blockList);
}

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withMetroConfig(baseConfig, {
  root,
  dirname: __dirname,
});

module.exports = config;
