const { BOT_COUNT, BOT_NAMES } = require('../../config/ServerConstants');
const Logger = require('../../utils/Logger');

class BotManager {
    constructor(io, container) {
        this.io = io;
        this.container = container;
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
            name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
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
        // Simple AI: Find nearest food
        let nearestDist = Infinity;
        let targetX = bot.x;
        let targetY = bot.y;

        // Search for food
        const allFood = this.foodManager.getAllFood();
        Object.keys(allFood).forEach((fid) => {
            const f = allFood[fid];
            const dx = f.x - bot.x;
            const dy = f.y - bot.y;
            const d = dx * dx + dy * dy;
            if (d < nearestDist) {
                nearestDist = d;
                targetX = f.x;
                targetY = f.y;
            }
        });

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
