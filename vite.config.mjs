import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.HDCPU_BASE_PATH && env.HDCPU_BASE_PATH.trim().length > 0
    ? env.HDCPU_BASE_PATH
    : '/';
  const enableSourcemap = env.HDCPU_SOURCEMAP === 'true';

  return {
    base,
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    build: {
      outDir: 'dist',
      sourcemap: enableSourcemap,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.id?.includes('framer-motion')) {
            return;
          }

          warn(warning);
        },
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            codemirror: ['@uiw/react-codemirror', '@codemirror/lang-javascript'],
            motion: ['framer-motion'],
          },
        },
      },
    },
  };
});
