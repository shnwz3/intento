import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    base: './',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(rootDir, 'src/renderer/index.html'),
                brain: path.resolve(rootDir, 'src/renderer/brain.html'),
                hud: path.resolve(rootDir, 'src/renderer/hud.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(rootDir, 'src/renderer/src'),
            '@components': path.resolve(rootDir, 'src/renderer/src/components'),
            '@hooks': path.resolve(rootDir, 'src/renderer/src/hooks'),
            '@store': path.resolve(rootDir, 'src/renderer/src/store'),
            '@styles': path.resolve(rootDir, 'src/renderer/src/styles'),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
                silenceDeprecations: ['legacy-js-api'],
                additionalData: `@use "@styles/variables" as *; @use "@styles/mixins" as *;`,
            },
        },
    },
    server: {
        port: 5173,
    },
});
