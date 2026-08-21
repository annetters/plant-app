const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Lets Metro resolve and watch the sibling @plant-app/domain workspace
// package, which lives outside apps/mobile.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// @plant-app/domain's source imports use explicit ".js" extensions (NodeNext
// module resolution — resolved to the sibling ".ts" file by tsc/Vite, but
// Metro has no such fallback and looks for a literal ".js" file). Retry as
// ".ts" whenever Metro's default resolution can't find the ".js" it asked for.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith('.js')) {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, '.ts'), platform);
    }
    throw error;
  }
};

module.exports = config;
