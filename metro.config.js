// Default Expo Metro config, plus .wasm so expo-sqlite can bundle for web (used by the dev-only demo mode for screenshots).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
