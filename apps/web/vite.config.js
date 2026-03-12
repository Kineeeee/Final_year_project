import { defineConfig, loadEnv } from 'vite';

// Allow VITE_* variables from repo root (.env) and ./phaser-project/.env
const withEnv = (mode) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return env;
};

export default defineConfig(({ mode }) => {
    const env = withEnv(mode);
    const define = {};
    if (env.VITE_SERVER_URL) {
        define.__SERVER_URL__ = JSON.stringify(env.VITE_SERVER_URL);
    }

    return {
        base: './',
        define,
        build: {
            assetsDir: 'assets',
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules/phaser')) return 'phaser';
                        if (id.includes('/src/modules/achievements/')) return 'achievements';
                        if (id.includes('/src/ui/')) return 'ui-kit';
                        if (id.includes('node_modules')) return 'vendor';
                        return null;
                    },
                },
            },
        },
        server: {
            host: '0.0.0.0',
        },
    };
});
