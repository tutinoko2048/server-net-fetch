import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    register: 'src/register.ts',
  },
  outDir: 'dist',
  external: ['@minecraft/server-net'],
  dts: true,
  sourcemap: true,
});
