import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './public/manifest.json';

export default defineConfig(({ mode }) => {
  const isExtensionBuild = mode === 'extension';

  let commitHash = 'unknown';
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.warn('Failed to get git commit hash');
  }
  const buildTime = new Date().toLocaleString();

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [
      react(),
      ...(isExtensionBuild ? [crx({ manifest })] : []),
    ],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
  };
});
