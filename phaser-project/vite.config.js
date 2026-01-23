import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
    },
    server: {
        host: '0.0.0.0',
    },
});
