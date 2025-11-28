import { defineConfig } from 'tsdown';

const isDev = process.argv.includes('--watch');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: !isDev,
  clean: true,
  skipNodeModulesBundle: true,
});
