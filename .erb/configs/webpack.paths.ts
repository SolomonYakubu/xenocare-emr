import path from 'path';

// Resolve everything from the repository root. Webpack is always invoked from
// there by the npm scripts. Deliberately avoids import.meta so these configs
// load through ts-node as CommonJS on Node 20 (macOS and Windows).
const rootPath = process.cwd();
const erbPath = path.join(rootPath, '.erb');
const configsDir = path.join(erbPath, 'configs');

const erbNodeModulesPath = path.join(erbPath, 'node_modules');
const dllPath = path.join(configsDir, '../dll');
const srcPath = path.join(rootPath, 'src');
const srcMainPath = path.join(srcPath, 'main');
const srcRendererPath = path.join(srcPath, 'renderer');
const releasePath = path.join(rootPath, 'release');
const appPath = path.join(releasePath, 'app');
const appPackagePath = path.join(appPath, 'package.json');
const appNodeModulesPath = path.join(appPath, 'node_modules');
const srcNodeModulesPath = path.join(srcPath, 'node_modules');
const distPath = path.join(appPath, 'dist');
const distMainPath = path.join(distPath, 'main');
const distRendererPath = path.join(distPath, 'renderer');
const buildPath = path.join(releasePath, 'build');

export default {
  rootPath,
  erbNodeModulesPath,
  dllPath,
  srcPath,
  srcMainPath,
  srcRendererPath,
  releasePath,
  appPath,
  appPackagePath,
  appNodeModulesPath,
  srcNodeModulesPath,
  distPath,
  distMainPath,
  distRendererPath,
  buildPath,
};
