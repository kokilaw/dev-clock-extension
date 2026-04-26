const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const manifestPath = path.join(projectRoot, 'manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const packageJson = readJson(packageJsonPath);
  const manifest = readJson(manifestPath);

  if (typeof packageJson.version !== 'string' || !packageJson.version) {
    throw new Error('package.json version is missing or invalid');
  }

  if (manifest.version === packageJson.version) {
    console.log(`manifest.json already in sync (${manifest.version})`);
    return;
  }

  manifest.version = packageJson.version;
  writeJson(manifestPath, manifest);
  console.log(`Synced manifest.json version to ${manifest.version}`);
}

main();
