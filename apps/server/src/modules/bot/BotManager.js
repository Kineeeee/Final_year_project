const { BOT_COUNT, BOT_NAMES, WORLD_SIZE } = require('../../config/ServerConstants');
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

        const id = 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
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
        // Optimized AI: Use Spatial Grid to find nearest entities
        const spatialGrid = this.container.get('spatialGrid');
        
        let targetX = bot.x;
        let targetY = bot.y;
        let wantsToBoost = false;

        // Threat & Opportunity detection
        let nearestThreat = null;
        let nearestThreatDist = Infinity;
        let nearestPrey = null;
        let nearestPreyDist = Infinity;
        let nearestFoodDist = Infinity;
        
        if (spatialGrid) {
            const searchRadius = 1000; // Tune based on world density
            const nearbyEntities = spatialGrid.query(bot.x, bot.y, searchRadius);
            
            for (const entity of nearbyEntities) {
                if (entity.id === bot.id) continue; // Bỏ qua bản thân

                const dx = entity.x - bot.x;
                const dy = entity.y - bot.y;
                const d = dx * dx + dy * dy;

                // Tính toán góc tương đối
                const angleToEntity = Math.atan2(dy, dx);
                let angleDiff = angleToEntity - bot.rotation;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                if (entity.playerId) {
                    // Xử lý thực thể là Player hoặc Bot khác
                    // Chỉ quan tâm nếu họ ở trong góc nhìn phía trước (180 độ)
                    if (Math.abs(angleDiff) < Math.PI / 2) {
                        // Nếu là đối thủ có thể gây nguy hiểm (khoảng cách gần)
                        if (d < 300 * 300) {
                            if (d < nearestThreatDist) {
                                nearestThreatDist = d;
                                nearestThreat = entity;
                            }
                        }
                    }
                    
                    // Cơ hội tấn công: Nếu đối thủ nhỏ hơn và đang ở gần, ta có thể "tạt đầu"
                    if (bot.score > (entity.score || 0) + 10 && d < 400 * 400) {
                         if (d < nearestPreyDist) {
                             nearestPreyDist = d;
                             nearestPrey = entity;
                         }
                    }
                } else if (entity.type) {
                    // Xử lý thực thể là Thức ăn
                    // Lô-gic chống kẹt: Phạt các thức ăn ở góc cua gắt
                    let penalty = 1;
                    if (Math.abs(angleDiff) > Math.PI / 2) {
                        penalty = 15; 
                    } else if (Math.abs(angleDiff) > Math.PI / 4) {
                        penalty = 3;
                    }

                    // Ưu tiên thức ăn giá trị cao (coin)
                    if (entity.type === 'coin') penalty *= 0.3;

                    const effectiveDist = d * penalty;

                    if (effectiveDist < nearestFoodDist) {
                        nearestFoodDist = effectiveDist;
                        targetX = entity.x;
                        targetY = entity.y;
                    }
                }
            }
        } else {
            // Fallback nếu không có SpatialGrid (rất hiếm khi xảy ra)
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
                    penalty = 15; 
                } else if (Math.abs(angleDiff) > Math.PI / 4) {
                    penalty = 3;
                }

                const effectiveDist = d * penalty;

                if (effectiveDist < nearestFoodDist) {
                    nearestFoodDist = effectiveDist;
                    targetX = f.x;
                    targetY = f.y;
                }
            });
        }

        // ==========================================
        // QUYẾT ĐỊNH HÀNH VI (BEHAVIOR HIERARCHY)
        // ==========================================
        
        // 1. Tránh viền bản đồ (Ưu tiên cao nhất)
        const borderMargin = 300;
        let borderDanger = false;
        let evadeX = 0;
        let evadeY = 0;

        if (bot.x < borderMargin) { evadeX = 1; borderDanger = true; }
        else if (bot.x > WORLD_SIZE - borderMargin) { evadeX = -1; borderDanger = true; }

        if (bot.y < borderMargin) { evadeY = 1; borderDanger = true; }
        else if (bot.y > WORLD_SIZE - borderMargin) { evadeY = -1; borderDanger = true; }

        if (borderDanger) {
            // Quay đầu vào giữa bản đồ
            targetX = bot.x + evadeX * 200;
            targetY = bot.y + evadeY * 200;
            wantsToBoost = false;
        } 
        // 2. Né tránh nguy hiểm (Có đối thủ ngay phía trước)
        else if (nearestThreat) {
            const dx = nearestThreat.x - bot.x;
            const dy = nearestThreat.y - bot.y;
            // Bẻ lái 90 độ để né
            targetX = bot.x - dy; 
            targetY = bot.y + dx;
            wantsToBoost = true; // Tăng tốc để chạy trốn
        }
        // 3. Tấn công con mồi (Tạt đầu)
        else if (nearestPrey && bot.score > 15) {
            // Dự đoán hướng đi của con mồi và lao lên phía trước họ
            const preyRot = nearestPrey.rotation || 0;
            targetX = nearestPrey.x + Math.cos(preyRot) * 200;
            targetY = nearestPrey.y + Math.sin(preyRot) * 200;
            wantsToBoost = true;
        }
        // 4. Tìm thức ăn
        else if (nearestFoodDist < Infinity) {
            // Tăng tốc nếu thức ăn ngay sát và có đủ điểm
            if (nearestFoodDist < 150 * 150 && bot.score > 5) {
                wantsToBoost = true;
            }
        } 
        // 5. Đi lang thang (Wander)
        else {
            // Không đi thẳng tắp mà hơi uốn lượn để tự nhiên hơn
            bot.targetRotation = bot.rotation + (Math.random() * 0.4 - 0.2);
            bot.wantsToBoost = false;
            return; // Đã gán targetRotation trực tiếp
        }

        // Tính toán góc mục tiêu cuối cùng
        bot.targetRotation = Math.atan2(targetY - bot.y, targetX - bot.x);
        
        // Quản lý năng lượng (Chỉ boost khi cần thiết và có tỷ lệ random để không bị cạn kiệt khối lượng)
        if (wantsToBoost && bot.score > 5 && Math.random() < 0.8) {
            bot.wantsToBoost = true;
        } else {
            bot.wantsToBoost = false;
        }
    }
}

module.exports = BotManager;
