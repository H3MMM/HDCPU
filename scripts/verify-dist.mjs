import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(`[deploy:check] ${message}`);
  process.exit(1);
}

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!existsSync(distDir)) {
  fail('Missing dist directory. Run npm run build first.');
}

if (!existsSync(indexPath)) {
  fail('Missing dist/index.html. The production bundle is incomplete.');
}

const html = readFileSync(indexPath, 'utf8');

if (!html.includes('<div id="root"></div>')) {
  fail('index.html is missing the #root mount node.');
}

if (html.includes('/src/main.tsx')) {
  fail('index.html still points at /src/main.tsx instead of production assets.');
}

const assetMatches = Array.from(
  html.matchAll(/(?:src|href)="([^"]+)"/g),
  (match) => match[1],
).filter((assetPath) => assetPath.startsWith('/') || assetPath.startsWith('./assets') || assetPath.startsWith('/assets'));

if (assetMatches.length === 0) {
  fail('No built asset references were found in dist/index.html.');
}

for (const assetPath of assetMatches) {
  if (/^(https?:)?\/\//.test(assetPath)) {
    continue;
  }

  const normalizedPath = assetPath.startsWith('/')
    ? assetPath.slice(1)
    : assetPath.replace(/^\.\//, '');
  const resolvedPath = path.join(distDir, normalizedPath);

  if (!existsSync(resolvedPath)) {
    fail(`Missing built asset: ${normalizedPath}`);
  }
}

console.log('[deploy:check] Production bundle validation passed.');
