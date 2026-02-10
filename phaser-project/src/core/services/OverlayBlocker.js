/**
 * Simple ref-counted blocker to replace window.__UI_BLOCKED.
 * Usage:
 *   const token = overlayBlocker.block('upload');
 *   overlayBlocker.unblock(token);
 *   overlayBlocker.isBlocked();
 */
class OverlayBlocker {
    constructor() {
        this.count = 0;
        this.tokens = new Set();
    }
    block(reason = 'unknown') {
        const token = `${reason}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.tokens.add(token);
        this.count++;
        return token;
    }
    unblock(token) {
        if (token && this.tokens.has(token)) {
            this.tokens.delete(token);
            this.count = Math.max(0, this.count - 1);
        }
    }
    isBlocked() {
        return this.count > 0;
    }
    reset() {
        this.tokens.clear();
        this.count = 0;
    }
}

export const overlayBlocker = new OverlayBlocker();
