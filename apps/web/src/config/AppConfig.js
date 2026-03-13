import { SHARED_CONFIG } from './SharedConfig';

// Server URL injected at build time via Vite define.
// Fallback strategy:
// 1) Use env-injected __SERVER_URL__ (set via VITE_SERVER_URL).
// 2) Derive from current page origin but swap port to 3000 (works for LAN/localhost).
// 3) Last resort: local server default.
const deriveFromLocation = () => {
    if (typeof window === 'undefined' || !window.location) return null;
    try {
        const url = new URL(window.location.origin);
        // Local dev: if Vite runs on 5173, backend is expected on 3000.
        // Production behind reverse proxy: keep same origin.
        if (url.port === '5173') {
            url.port = '3000';
        }
        return url.origin;
    } catch {
        return null;
    }
};

const SERVER_URL =
    (typeof __SERVER_URL__ !== 'undefined' ? __SERVER_URL__ : null) ||
    deriveFromLocation() ||
    'http://localhost:3000';

export const CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    BACKGROUND_COLOR: '#028af8',
    WORLD_WIDTH: SHARED_CONFIG.WORLD_SIZE,
    WORLD_HEIGHT: SHARED_CONFIG.WORLD_SIZE,
    INITIAL_LENGTH: SHARED_CONFIG.INITIAL_LENGTH,

    // Client Physics Mirror (Must match Server)
    PHYSICS: {
        BASE_SPEED_PPS: SHARED_CONFIG.BASE_SPEED * SHARED_CONFIG.FPS, // Synced to Server Speed * FPS
        BOOST_SPEED_PPS: SHARED_CONFIG.BOOST_SPEED * SHARED_CONFIG.FPS,
        ROTATION_SPEED_PPS: SHARED_CONFIG.TURN_SPEED * SHARED_CONFIG.FPS,
        PLAYER_SCALE_BASE: SHARED_CONFIG.PLAYER_SCALE_BASE,
        PLAYER_SCALE_GROWTH: SHARED_CONFIG.PLAYER_SCALE_GROWTH,
        PIXELS_PER_SEGMENT: SHARED_CONFIG.PIXELS_PER_SEGMENT,
        FOOD_RADIUS: SHARED_CONFIG.FOOD_RADIUS * 1.5, // Visual adjustment if needed, or keep 1.5 multiplier as was implicit?
        // Original client was 15, server 10. 10 * 1.5 = 15.
        // Let's explicitly check.
    },

    // Food & Coins
    FOOD: {
        SPEED: 800,
        RADIUS_REGULAR: 10,
        RADIUS_QUIZ: 35,
        COLORS: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff],
        QUIZ_BG_COLOR: 0xffffff,
        QUIZ_TEXT_COLOR: '#000000',
    },
    COIN: {
        COLOR: 0xffd700,
        STROKE_COLOR: 0xffffff,
        RADIUS: 12,
        SPEED: 900,
    },

    SERVER_URL,

    NETWORK: {
        // Opt-in: when true, the client will apply server-authoritative interest-managed deltas
        // from the `worldDelta` event. Keep false until the client interpolation path is ready.
        USE_WORLD_DELTA: true,

        // Render delay (ms) for interpolation. Typical values: 80-140.
        INTERPOLATION_DELAY_MS: 60,

        // Exponential smoothing factor for serverTime offset (0..1).
        // Higher = reacts faster, lower = more stable.
        SERVER_TIME_OFFSET_ALPHA: 0.1,
    },

    // UI Constants
    UI: {
        CAMERA_BG: 0x444444,
        TOAST_SUCCESS: '#00ff00',
        TOAST_ERROR: '#ff0000',
        TEXT_CORRECT: 0x00ff00,
        TEXT_WRONG: 0xff0000,
        FALLBACK_FOOD_COLOR: 0xff0000,
    },

    // Zoom & Camera
    ZOOM: {
        BASE: 1.0,
        MIN: 0.5,
        MAX: 1.0,
        TARGET_WIDTH: 1440,
        SMOOTH_FACTOR: 0.05,
    },

    // Intervals (ms)
    INTERVALS: {
        PING: 1000,
        MINIMAP_UPDATE: 1000,
        FLOAT_TEXT_DURATION: 1000,
        BATCH_SPAWN: 16,
    },

    // Game Modes
    GAME_MODES: {
        NORMAL: 'normal',
        MATH: 'math',
        ENGLISH: 'english',
    },

    // Item/Buff Keys
    ITEMS: {
        GHOST: SHARED_CONFIG.ITEMS.GHOST.id,
        MAGNET: SHARED_CONFIG.ITEMS.MAGNET.id,
        SPEED: SHARED_CONFIG.ITEMS.SPEED_UP.id,
    },

    // Asset Keys
    ASSETS: {
        BACKGROUND: 'background',
    },

    // Batching
    BATCH: {
        SPAWN_SIZE: 20,
    },

    // Text Styles
    STYLES: {
        FLOAT_TEXT: {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        },
    },

    GRAPHICS: {
        LOW_QUALITY: false, // Set to true to disable shadows and particles for low-end devices
    },

    SCENES: {
        GAME: 'Game',
        UI: 'UIScene',
        GAME_OVER: 'GameOver',
        MAIN_MENU: 'MainMenu',
        PRELOADER: 'Preloader',
        BOOT: 'Boot',
        CUSTOMIZE: 'CustomizeScene',
        SHOP: 'ShopScene',
    },
};
