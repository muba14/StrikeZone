import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome110'],
  outfile: 'dist/game.js',
  logLevel: 'info',
});
copyFileSync('src/index.html', 'dist/index.html');
copyFileSync('src/style.css', 'dist/style.css');
