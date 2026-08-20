// A partir do SDK 52, o Expo detecta o monorepo sozinho e configura watchFolders e
// nodeModulesPaths. Não adicione essas opções à mão: elas conflitam com a detecção
// automática e quebram a resolução dos pacotes do workspace.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
