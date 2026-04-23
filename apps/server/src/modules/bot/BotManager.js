const { BOT_COUNT, BOT_NAMES } = require('../../config/ServerConstants');
const Logger = require('../../utils/Logger');

class BotManager {
    constructor(io, container) {
        this.io = io;
        this.container = container;
        this.botNameCounts = new Map();
        // Dependencies resolved via Container
    }

    get playerManager() {
        return this.container.get('playerManager');
    }
    get foodManager() {
        return this.container.get('foodManager');
    }
    get spawnManager() {
        return this.container.get('spawnManager');
    }

    generateBotName() {
        const baseName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        const currentCount = this.botNameCounts.get(baseName) || 0;
        const nextCount = currentCount + 1;
        this.botNameCounts.set(baseName, nextCount);
        return `${baseName} #${nextCount}`;
    }

    createBot() {
        if (!this.spawnManager) {
            Logger.warn('BotManager', 'SpawnManager not set, cannot create bot');
            return;
        }

        const id = 'bot-' + Math.floor(Math.random() * 1000000);
        const spawnPos = this.spawnManager.getSafeSpawnPosition();
        const rot = Math.random() * Math.PI * 2;

        const botData = {
            rotation: rot,
            targetRotation: rot,
            x: spawnPos.x,
            y: spawnPos.y,
            id: id, // Compatible with SpatialGrid
            playerId: id,
            team: 'red',
            score: Math.floor(Math.random() * 5),
            path: [],
            isBot: true,
            color: Math.floor(Math.random() * 0xffffff),
            name: this.generateBotName(),
            totalDistance: 0,
            isBoosting: false,
            wantsToBoost: false,
            activeEffects: {},
            coins: 0,
            inventory: {},
            boostTimer: 0,
        };

        // DECOUPLED: Use PlayerManager API
        this.playerManager.addBot(botData);

    }

    update() {
        // Spawn Bots if needed
        const players = this.playerManager.getAllPlayers();
        const currentBotCount = Object.values(players).filter((p) => p.isBot).length;

        if (currentBotCount < BOT_COUNT) {
            if (Math.random() < 0.05) {
                // Don't spawn all at once
                this.createBot();
            }
        }

        // Update AI for existing bots
        Object.keys(players).forEach((id) => {
            const player = players[id];
            if (player && player.isBot) {
                this.updateBotAI(player);
            }
        });
    }

    updateBotAI(bot) {
        // Optimized AI: Use Spatial Grid to find nearest food (O(1) instead of O(n))
        let nearestDist = Infinity;
        let targetX = bot.x;
        let targetY = bot.y;
        let nearestFood = null;

        // Query nearby food using spatial grid (500 unit radius reasonable for search)
        const spatialGrid = this.container.get('spatialGrid');
        if (spatialGrid) {
            const searchRadius = 800; // Tune based on world density
            const nearbyEntities = spatialGrid.query(bot.x, bot.y, searchRadius);
            
            for (const entity of nearbyEntities) {
                // Filter to only foods
                if (!entity.playerId && entity.type) {
                    const dx = entity.x - bot.x;
                    const dy = entity.y - bot.y;
                    const d = dx * dx + dy * dy;
                    
                    // Lô-gic chống kẹt (Anti-orbiting): Phạt các thức ăn ở góc cua gắt
                    const angleToFood = Math.atan2(dy, dx);
                    let angleDiff = angleToFood - bot.rotation;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    
                    // Nếu thức ăn ở phía sau (góc lớn hơn 90 độ), tăng khoảng cách ảo lên nhiều lần
                    // để ưu tiên thức ăn phía trước mặt
                    let penalty = 1;
                    if (Math.abs(angleDiff) > Math.PI / 2) {
                        penalty = 10; 
                    } else if (Math.abs(angleDiff) > Math.PI / 4) {
                        penalty = 2;
                    }

                    const effectiveDist = d * penalty;

                    if (effectiveDist < nearestDist) {
                        nearestDist = effectiveDist;
                        targetX = entity.x;
                        targetY = entity.y;
                        nearestFood = entity;
                    }
                }
            }
        } else {
            // Fallback: simple search if spatial grid not available
            const allFood = this.foodManager.getAllFood();
            Object.keys(allFood).forEach((fid) => {
                const f = allFood[fid];
                const dx = f.x - bot.x;
                const dy = f.y - bot.y;
                const d = dx * dx + dy * dy;

                const angleToFood = Math.atan2(dy, dx);
                let angleDiff = angleToFood - bot.rotation;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                let penalty = 1;
                if (Math.abs(angleDiff) > Math.PI / 2) {
                    penalty = 10; 
                } else if (Math.abs(angleDiff) > Math.PI / 4) {
                    penalty = 2;
                }

                const effectiveDist = d * penalty;

                if (effectiveDist < nearestDist) {
                    nearestDist = effectiveDist;
                    targetX = f.x;
                    targetY = f.y;
                }
            });
        }

        // Calculate target angle
        bot.targetRotation = Math.atan2(targetY - bot.y, targetX - bot.x);

        // Boost if close to food and has score > 5
        if (nearestDist < 200 * 200 && bot.score > 5) {
            bot.wantsToBoost = true;
        } else {
            bot.wantsToBoost = false;
        }
    }
}

module.exports = BotManager;
