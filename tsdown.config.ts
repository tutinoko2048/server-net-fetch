import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    register: 'src/register.ts',
  },
  outDir: 'dist',
  deps: {
    onlyBundle: false,
    neverBundle: ['@minecraft/server-net'],
  },
  dts: true,
  exports: true,
  // sourcemap: true,
});
