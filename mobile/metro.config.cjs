const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../packages/shared")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
// Shared package is framework-free; Expo's own nested dependencies need normal lookup.
config.resolver.disableHierarchicalLookup = false;
module.exports = config;
