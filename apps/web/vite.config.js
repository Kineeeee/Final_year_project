import { defineConfig, loadEnv } from 'vite';

// Allow VITE_* variables from repo root (.env) and ./phaser-project/.env
const withEnv = (mode) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return env;
};

export default defineConfig(({ mode }) => {
    const env = withEnv(mode);
    return {
        base: './',
        define: {
            __SERVER_URL__: JSON.stringify(env.VITE_SERVER_URL || 'http://localhost:3000'),
        },
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
    };
});
