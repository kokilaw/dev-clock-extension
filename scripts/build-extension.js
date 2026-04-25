const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const requiredFiles = [
  'manifest.json',
  'converter-popup.html',
  'options.html',
  path.join('src', 'options', 'options.js'),
  path.join('src', 'shared', 'preferences.js'),
  path.join('src', 'shared', 'timestamp-parser.js'),
  path.join('src', 'background', 'service-worker.js'),
  path.join('src', 'popup', 'converter-controller.js'),
  path.join('lib', 'luxon.min.js'),
  path.join('lib', 'parser-vendors.js'),
  path.join('icons', 'icon16.png'),
  path.join('icons', 'icon48.png'),
  path.join('icons', 'icon128.png'),
];

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cleanDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

function copyRequiredFiles() {
  for (const relativeFile of requiredFiles) {
    const source = path.join(projectRoot, relativeFile);
    const destination = path.join(distDir, relativeFile);

    if (!fs.existsSync(source)) {
      throw new Error(`Missing required build input: ${relativeFile}`);
    }

    ensureParentDir(destination);
    fs.copyFileSync(source, destination);
  }
}

function main() {
  cleanDist();
  copyRequiredFiles();
  console.log('Extension build complete: dist/');
}

main();
