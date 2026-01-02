const { WORLD_SIZE, SAFE_SPAWN_RADIUS } = require('../config/constants');
const Logger = require('../utils/Logger');

class SpawnManager {
    constructor(playerManager) {
        this.playerManager = playerManager;
    }

    getSafeSpawnPosition() {
        let safe = false;
        let x, y;
        let attempts = 0;
        const safeRadius = SAFE_SPAWN_RADIUS;

        const players = this.playerManager.getAllPlayers();

        while (!safe && attempts < 50) {
            x = Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100;
            y = Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100;
            safe = true;

            // Check against all other players
            for (const id in players) {
                const p = players[id];
                // Check distance to head
                const distHead = Math.hypot(x - p.x, y - p.y);
                if (distHead < safeRadius) {
                    safe = false;
                    break;
                }
                // Check distance to body segments
                if (p.path) {
                    for (let i = 0; i < p.path.length; i += 10) { // Check every 10th point for performance
                        const point = p.path[i];
                        const distBody = Math.hypot(x - point.x, y - point.y);
                        if (distBody < safeRadius) {
                            safe = false;
                            break;
                        }
                    }
                }
                if (!safe) break;
            }
            attempts++;
        }

        if (!safe) {
            Logger.warn("SpawnManager", "Could not find safe spawn, using random");
        }
        return { x, y };
    }
}

module.exports = SpawnManager;
