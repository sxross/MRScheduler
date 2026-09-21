// Monorepo Metro config: watch the workspace packages and resolve their
// dependencies from the root node_modules as well as the app's own.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// The workspace packages publish raw TypeScript from `main`, which Metro
// transpiles happily; this stops it falling back to a hoisted duplicate.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
