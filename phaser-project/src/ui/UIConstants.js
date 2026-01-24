export const COLORS = {
    // Primary Actions (Play, Confirm, Buy)
    PRIMARY: 0x00CC66,  // Vivid Green
    PRIMARY_HOVER: 0x00FF88,

    // Secondary Actions (Navigate, Info, Filter)
    SECONDARY: 0x3399FF, // Bright Blue
    SECONDARY_HOVER: 0x66BBFF,

    // Accents (Coins, Scores, Highlights)
    ACCENT: 0xFFCC00,    // Golden Yellow
    ACCENT_HOVER: 0xFFDD33,

    // Danger / Negative (Close, Exit, Delete)
    DANGER: 0xFF5555,    // Soft Red
    DANGER_HOVER: 0xFF7777,

    // Neutral / Backgrounds
    PANEL_BG: 0x222222,
    PANEL_BORDER: 0x444444,
    OVERLAY: 0x000000,
    OVERLAY_ALPHA: 0.7,

    // Text Colors (Web formats for Phaser Text objects)
    TEXT: {
        LIGHT: '#FFFFFF',
        DARK: '#222222',
        ACCENT: '#FFCC00',
        DANGER: '#FF5555',
        MUTED: '#AAAAAA'
    }
};

export const FONTS = {
    FAMILY: '"Outfit", sans-serif'
};

export const TEXT_STYLES = {
    HEADER: {
        fontFamily: FONTS.FAMILY,
        fontSize: 48,
        color: COLORS.TEXT.LIGHT,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
    },
    SUBHEADER: {
        fontFamily: FONTS.FAMILY,
        fontSize: 32,
        color: COLORS.TEXT.LIGHT,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
    },
    BODY: {
        fontFamily: FONTS.FAMILY,
        fontSize: 24,
        color: COLORS.TEXT.LIGHT,
        // Adding proper shadow to body text for readability against mixed backgrounds
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 1, stroke: true, fill: true },
        stroke: '#000000',
        strokeThickness: 2
    },
    BUTTON: {
        fontFamily: FONTS.FAMILY,
        fontSize: 28,
        color: COLORS.TEXT.LIGHT,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
    }
};

export const DIMENSIONS = {
    BUTTON: {
        HEIGHT: 60,
        RADIUS: 20
    },
    PANEL: {
        RADIUS: 24,
        BORDER_WIDTH: 3
    }
};
