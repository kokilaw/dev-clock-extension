const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'node_modules', 'luxon', 'build', 'global', 'luxon.min.js');
const target = path.join(projectRoot, 'lib', 'luxon.min.js');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  if (!fs.existsSync(source)) {
    throw new Error('Luxon not found in node_modules. Run npm install first.');
  }

  ensureDir(target);
  fs.copyFileSync(source, target);
  console.log('Synced Luxon bundle to lib/luxon.min.js');
}

main();
