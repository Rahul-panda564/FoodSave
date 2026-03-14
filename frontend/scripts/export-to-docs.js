const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const docsDir = path.resolve(__dirname, '..', '..', 'docs');

if (!fs.existsSync(buildDir)) {
  console.error('Build folder not found. Run npm run build first.');
  process.exit(1);
}

if (fs.existsSync(docsDir)) {
  fs.rmSync(docsDir, { recursive: true, force: true });
}

fs.mkdirSync(docsDir, { recursive: true });
fs.cpSync(buildDir, docsDir, { recursive: true });

const noJekyllPath = path.join(docsDir, '.nojekyll');
fs.writeFileSync(noJekyllPath, '');

console.log('Exported frontend/build to docs/ for GitHub Pages (main/docs).');
