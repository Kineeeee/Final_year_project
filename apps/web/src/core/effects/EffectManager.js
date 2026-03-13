import { CONFIG } from '../../config/AppConfig';

class EffectManager {
    constructor() {
        this.effects = {
            [CONFIG.ITEMS.GHOST]: (snake, active, value) => snake.setGhostEffect(active, value),
            [CONFIG.ITEMS.MAGNET]: (snake, active, value) => snake.setMagnetEffect(active, value),
            [CONFIG.ITEMS.SPEED]: (snake, active, value) => snake.setSpeedEffect(active, value),
        };
    }

    applyEffect(snake, itemId, active, value) {
        // If itemId comes from server as string, it should match constants
        const handler = this.effects[itemId];
        if (handler) {
            handler(snake, active, value);
        } else {
            console.warn(`EffectManager: Unknown item ID '${itemId}'`);
        }
    }
}

export const effectManager = new EffectManager();
