const {
    WORLD_SIZE,
    BOT_COUNT,
    BOT_NAMES,
    BASE_SPEED,
    BOOST_SPEED,
    TURN_SPEED,
    PIXELS_PER_SEGMENT,
    FOOD_RADIUS
} = require('../config/constants');
const User = require('../models/User');

class PlayerManager {
    constructor(io, foodManager) {
        this.io = io;
        this.foodManager = foodManager;
        this.players = {};
        // We need a way to spawn bots, which requires spawn position.
        // Since SpawnManager depends on PlayerManager, we can't inject SpawnManager in constructor easily if circular.
        // We will set spawnManager later or pass it to methods.
        this.spawnManager = null;
    }

    setSpawnManager(spawnManager) {
        this.spawnManager = spawnManager;
    }

    addPlayer(socket, spawnPos) {
        this.players[socket.id] = {
            rotation: 0,
            targetRotation: 0,
            x: spawnPos.x,
            y: spawnPos.y,
            playerId: socket.id,
            team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
            score: 0, // Initial score/length
            path: [], // History of positions for body collision
            totalDistance: 0, // Track total distance for accurate path pruning
            name: "Player " + Math.floor(Math.random() * 1000),
            color: Math.floor(Math.random() * 0xFFFFFF),
            isBoosting: false,
            wantsToBoost: false,
            coins: 0 // Track session coins for Guest/Economy
        };
        return this.players[socket.id];
    }

    createBot() {
        if (!this.spawnManager) return;

        const id = 'bot-' + Math.floor(Math.random() * 1000000);
        const spawnPos = this.spawnManager.getSafeSpawnPosition();
        const rot = Math.random() * Math.PI * 2;

        this.players[id] = {
            rotation: rot,
            targetRotation: rot,
            x: spawnPos.x,
            y: spawnPos.y,
            playerId: id,
            team: 'red',
            score: Math.floor(Math.random() * 5),
            path: [],
            isBot: true,
            color: Math.floor(Math.random() * 0xFFFFFF),
            name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            totalDistance: 0,
            isBoosting: false,
            wantsToBoost: false
        };
        this.io.emit('newPlayer', this.players[id]);
    }

    removePlayer(playerId) {
        const player = this.players[playerId];
        if (!player) return;

        console.log('Player died:', playerId);

        // Convert body to food
        if (player.path) {
            for (let i = 0; i < player.path.length; i += 4 * 2) { // Giữ nguyên logic cũ
                const point = player.path[i];
                const fx = point.x + (Math.random() * 20 - 10);
                const fy = point.y + (Math.random() * 20 - 10);

                // TỈ LỆ RƠI COIN: 50% cơ hội mỗi đốt thân sẽ biến thành Coin
                const isCoin = Math.random() < 0.5;

                let newFood;
                if (isCoin) {
                    newFood = this.foodManager.spawnFood(fx, fy, null, 'coin', 10);
                } else {
                    newFood = this.foodManager.spawnFood(fx, fy);
                }

                if (newFood) {
                    this.io.emit('newFood', newFood);
                }
            }
        }

        // Remove player
        delete this.players[playerId];

        // Notify the dead player specifically (so they see Game Over)
        if (!player.isBot) {
            this.io.to(playerId).emit('playerDied', playerId);
        }

        // Notify everyone else that this player is gone (so they remove the snake)
        this.io.emit('playerDisconnected', playerId);
    }

    handlePlayerInput(id, inputData) {
        try {
            if (this.players[id]) {
                // Store target rotation from client input
                this.players[id].targetRotation = inputData.angle;
                // Update boosting state (Input Request)
                this.players[id].wantsToBoost = inputData.isBoosting;
            }
        } catch (error) {
            console.error('Error handling playerInput:', error);
        }
    }

    handleInitPlayer(id, data) {
        if (this.players[id]) {
            if (data.color) {
                this.players[id].color = data.color;
            }
            if (data.name) {
                this.players[id].name = data.name;
                // Fix Economy: Assign username from name so coins can be saved
                this.players[id].username = data.name;
            }
            if (data.coins) {
                this.players[id].coins = parseInt(data.coins);
            }

            // Broadcast the updated properties to everyone so they see the new color
            this.io.emit('playerProperties', {
                id: id,
                color: this.players[id].color,
                name: this.players[id].name
            });
        }
    }

    updateBotAI(bot) {
        // Simple AI: Find nearest food
        let nearestDist = Infinity;
        let targetX = bot.x;
        let targetY = bot.y;

        // Search for food
        const allFood = this.foodManager.getAllFood();
        Object.keys(allFood).forEach(fid => {
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

    updateRotation(player) {
        if (player.targetRotation === undefined) return;

        let diff = player.targetRotation - player.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnSpeed = TURN_SPEED;

        if (Math.abs(diff) < turnSpeed) {
            player.rotation = player.targetRotation;
        } else {
            player.rotation += Math.sign(diff) * turnSpeed;
        }
    }

    getPlayerScale(score) {
        let scale = 0.6 + (10 + score) * 0.005;
        if (scale > 1.2) scale = 1.2;
        return scale;
    }

    getPlayerRadius(score) {
        // Sync with Client Visuals (15 * scale)
        // Previously 14, causing "visual touch but no server hit"
        return 15 * this.getPlayerScale(score);
    }

    update() {
        const segmentLength = 1; // Reduced for better precision near head

        // // Spawn Bots
        const currentBotCount = Object.values(this.players).filter(p => p.isBot).length;
        if (currentBotCount < BOT_COUNT) {
            if (Math.random() < 0.05) { // Don't spawn all at once
                this.createBot();
            }
        }

        // Update all players positions
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            if (!player) return;

            if (player.isBot) {
                this.updateBotAI(player);
            }

            // Apply rotation smoothing for everyone (Bots AND Players)
            this.updateRotation(player);

            // Determine current speed

            // Boost Logic with Hysteresis
            // Start criteria: wantsToBoost AND score > 5
            // Stop criteria: !wantsToBoost OR score <= 2
            if (!player.isBoosting && player.wantsToBoost && player.score > 5) {
                player.isBoosting = true;
            } else if (player.isBoosting && (!player.wantsToBoost || player.score <= 2)) {
                player.isBoosting = false;
            }

            let currentSpeed = BASE_SPEED;
            if (player.isBoosting) { // Can only boost if length > 2 (enforced by stop criteria)
                currentSpeed = BOOST_SPEED;

                // Burn mass logic
                // Decrease score every X frames? Or probabilistic?
                // Reduced from 0.05 (3/sec) to 0.02 (~1.2/sec) to make shrinking slower
                if (Math.random() < 0.03) {
                    player.score = Math.max(0, player.score - 1);

                    // Spawn food behind
                    // Get position from end of path or just behind head?
                    // Ideally behind tail, but path might be long.
                    // Let's spawn behind head for simplicity or last path point
                    const dropPos = player.path.length > 0 ? player.path[player.path.length - 1] : { x: player.x, y: player.y };

                    const newFood = this.foodManager.spawnFood(dropPos.x, dropPos.y, player.color); // Use player color?
                    if (newFood) {
                        this.io.emit('newFood', newFood);
                    }
                }
            }

            // Simple movement logic based on rotation
            // In a real implementation, this should match the client's physics exactly
            player.x += Math.cos(player.rotation) * currentSpeed;
            player.y += Math.sin(player.rotation) * currentSpeed;

            // Update Path for Body Collision
            // Use Distance-Based Pruning to match Client rendering exactly (Fixes Ghost Tail)
            player.totalDistance += currentSpeed;
            player.path.unshift({
                x: player.x,
                y: player.y,
                d: player.totalDistance
            });

            // Limit path length based on DISTANCE, not just count.
            // Client uses distance-based history.
            // Need history for (score) body parts * PIXELS_PER_SEGMENT
            // Add some buffer (+5 parts)
            const neededHistoryDist = (player.score + 5) * PIXELS_PER_SEGMENT;

            // Prune old points
            // path[last].d is the totalDistance at that point.
            // Current totalDistance is player.totalDistance.
            // Age of point = player.totalDistance - point.d
            while (player.path.length > 0 &&
                (player.totalDistance - player.path[player.path.length - 1].d > neededHistoryDist)) {
                player.path.pop();
            }

            // 1. Check Collision with World Bounds
            if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
                this.removePlayer(id);
                return;
            }

            // 2. Check Collision with Other Snakes
            Object.keys(this.players).forEach(otherId => {
                if (id === otherId) return;
                const other = this.players[otherId];

                const myRadius = this.getPlayerRadius(player.score);
                const otherRadius = this.getPlayerRadius(other.score);

                // 2a. Head-on-Head Collision
                // If two heads collide, BOTH die.
                const distHead = Math.hypot(player.x - other.x, player.y - other.y);
                if (distHead < myRadius + otherRadius) {
                    this.removePlayer(id);
                    this.removePlayer(otherId);
                    return; // Stop processing this player
                }

                // Check against other's body segments
                // We iterate through the path at intervals to simulate body segments
                // Start from index segmentLength (skip head area to avoid head-to-head instant death if close)
                // Increased precision: Check every 2 points instead of segmentLength (4)
                if (other.path) {
                    for (let i = segmentLength; i < other.path.length; i++) {
                        const point = other.path[i];
                        const dist = Math.hypot(player.x - point.x, player.y - point.y);
                        if (dist < myRadius + otherRadius) { // Collision radius (Head radius + Body radius)
                            this.removePlayer(id);
                            return;
                        }
                    }
                }
            });

            // Check collision with food
            const allFood = this.foodManager.getAllFood();
            Object.keys(allFood).forEach(async foodId => {
                const f = allFood[foodId];
                const dx = player.x - f.x;
                const dy = player.y - f.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const myRadius = this.getPlayerRadius(player.score);

                const MAGNET_RADIUS = 50;

                if (distance < myRadius + MAGNET_RADIUS) {
                    // Eat food
                    this.foodManager.removeFood(foodId);

                    //xử lý ăn coin
                    if (f.type === 'coin') {
                        // !bot -> thêm tiền
                        if (!player.isBot) {
                            try {
                                // Tìm user theo username (vì trong player object có lưu name)
                                // Lưu ý: player.name có thể là "Guest_..." hoặc tên thật.
                                // Tốt nhất là lưu username gốc vào player object lúc init.
                                // Giả sử player.username là tên đăng nhập chuẩn.
                                if (player.username && !player.username.startsWith('Guest_')) {
                                    await User.findOneAndUpdate(
                                        { username: player.username },
                                        { $inc: { coins: f.value } } // Cộng dồn tiền
                                    );
                                    // Gửi event báo cho Client biết tiền mới
                                    const updatedUser = await User.findOne({ username: player.username });
                                    this.io.to(id).emit('updateCoins', updatedUser.coins);
                                } else {
                                    // !guest -> cộng tiền vào bộ nhớ tạm (session)
                                    // Server không có localStorage, phải lưu vào biến player
                                    let currentCoins = parseInt(player.coins) || 0;
                                    player.coins = currentCoins + f.value;
                                    this.io.to(id).emit('updateCoins', player.coins);
                                }
                            } catch (err) {
                                console.error('Error updating coins:', err);
                            }
                        }
                    } else {
                        // Ăn thức ăn thường -> Tăng điểm
                        player.score += 1;
                    }

                    // Emit event to remove food and update score
                    // Use f.id to ensure we send a number, not the string key from Object.keys
                    this.io.emit('foodEaten', { foodId: f.id, playerId: id, score: player.score, type: f.type });

                    // Spawn new food
                    if (f.type !== 'coin') {
                        const newFood = this.foodManager.spawnFood();
                        if (newFood) this.io.emit('newFood', newFood);
                    }
                }
            });
        });
    }

    getAllPlayers() {
        return this.players;
    }
}

module.exports = PlayerManager;
