const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const repoRoot = path.resolve(__dirname, '..', '..');

if (!fs.existsSync(buildDir)) {
  console.error('Build folder not found. Run npm run build first.');
  process.exit(1);
}

const generatedRootEntries = [
  'index.html',
  'asset-manifest.json',
  'manifest.json',
  'robots.txt',
  'static',
  'images',
  '.nojekyll',
];

for (const entry of generatedRootEntries) {
  const target = path.join(repoRoot, entry);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

for (const entry of fs.readdirSync(buildDir)) {
  const source = path.join(buildDir, entry);
  const target = path.join(repoRoot, entry);
  fs.cpSync(source, target, { recursive: true });
}

fs.writeFileSync(path.join(repoRoot, '.nojekyll'), '');

console.log('Exported frontend/build to repository root for GitHub Pages (main/root).');
