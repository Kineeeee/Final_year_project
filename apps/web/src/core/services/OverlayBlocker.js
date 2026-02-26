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
        this.subscribers = new Set();
    }
    block(reason = 'unknown') {
        const token = `${reason}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.tokens.add(token);
        this.count++;
        this.notify();
        return token;
    }
    unblock(token) {
        if (token && this.tokens.has(token)) {
            this.tokens.delete(token);
            this.count = Math.max(0, this.count - 1);
            this.notify();
        }
    }
    isBlocked() {
        return this.count > 0;
    }
    reset() {
        this.tokens.clear();
        this.count = 0;
        this.notify();
    }
    subscribe(fn) {
        if (typeof fn !== 'function') return () => {};
        this.subscribers.add(fn);
        // emit current state immediately
        try { fn(this.isBlocked()); } catch (e) { /* ignore */ }
        return () => this.subscribers.delete(fn);
    }
    notify() {
        this.subscribers.forEach((fn) => {
            try { fn(this.isBlocked()); } catch (e) { /* ignore */ }
        });
    }
}

export const overlayBlocker = new OverlayBlocker();
