import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    base: './',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer/src'),
            '@components': path.resolve(__dirname, 'src/renderer/src/components'),
            '@hooks': path.resolve(__dirname, 'src/renderer/src/hooks'),
            '@store': path.resolve(__dirname, 'src/renderer/src/store'),
            '@styles': path.resolve(__dirname, 'src/renderer/src/styles'),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@use "@styles/variables" as *; @use "@styles/mixins" as *;`,
            },
        },
    },
    server: {
        port: 5173,
    },
});
