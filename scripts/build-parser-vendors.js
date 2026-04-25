const path = require('path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');

async function main() {
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'src', 'shared', 'parser-vendors-entry.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    outfile: path.join(projectRoot, 'lib', 'parser-vendors.js'),
    target: ['chrome114'],
    logLevel: 'info',
  });

  console.log('Bundled parser vendors to lib/parser-vendors.js');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
