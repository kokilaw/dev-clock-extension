const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const requiredFiles = [
  'manifest.json',
  'popup.html',
  'popup.js',
  path.join('lib', 'luxon.min.js'),
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
