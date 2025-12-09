const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

const players = {};
const food = {}; // Store food items: { id: { x, y, color } }
let foodIdCounter = 0;
const MAX_FOOD = 500;
const WORLD_SIZE = 5000;

function getSafeSpawnPosition() {
    let safe = false;
    let x, y;
    let attempts = 0;
    const safeRadius = 300; // Radius around spawn point that must be clear

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
        console.log("Could not find safe spawn, using random");
    }
    return { x, y };
}

function spawnFood(x, y, color) {
    // If coordinates are provided (death/boost), ignore the limit.
    // Otherwise (random spawn), respect the limit.
    if ((x !== undefined && y !== undefined) || Object.keys(food).length < MAX_FOOD) {
        const id = foodIdCounter++;
        food[id] = {
            id: id,
            x: x !== undefined ? x : Math.floor(Math.random() * WORLD_SIZE),
            y: y !== undefined ? y : Math.floor(Math.random() * WORLD_SIZE),
            color: color !== undefined ? color : Math.floor(Math.random() * 0xFFFFFF)
        };
        return food[id];
    }
    return null;
}

// Initial food spawn
for (let i = 0; i < 50; i++) {
    spawnFood();
}

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.send('Server is running');
});

io.on('connection', function (socket) {
    console.log('a user connected: ', socket.id);

    const spawnPos = getSafeSpawnPosition();

    // Create a new player object
    players[socket.id] = {
        rotation: 0,
        targetRotation: 0,
        x: spawnPos.x,
        y: spawnPos.y,
        playerId: socket.id,
        team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
        score: 0, // Initial score/length
        path: [], // History of positions for body collision
        name: "Player " + Math.floor(Math.random() * 1000),
        color: Math.floor(Math.random() * 0xFFFFFF)
    };

    // Send the players object to the new player
    socket.emit('currentPlayers', players);
    // Send current food to the new player
    socket.emit('currentFood', food);

    // Update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('disconnect', function () {
        console.log('user disconnected: ', socket.id);
        // Remove this player from our players object
        delete players[socket.id];
        // Emit a message to all players to remove this player
        io.emit('playerDisconnected', socket.id);
    });

    // Ping-Pong for latency check
    socket.on('ping', function () {
        socket.emit('pong');
    });

    // When a player moves, update the player data
    socket.on('playerInput', function (inputData) {
        try {
            if (players[socket.id]) {
                // Store target rotation from client input
                players[socket.id].targetRotation = inputData.angle;
                // Update boosting state
                players[socket.id].isBoosting = inputData.isBoosting;
            }
        } catch (error) {
            console.error('Error handling playerInput:', error);
        }
    });
});

// Server Game Loop (60 FPS)
const BOT_COUNT = 10;
const BOT_NAMES = ["Viper", "Python", "Anaconda", "Cobra", "Boa", "Mamba", "Sidewinder", "Rattler", "Nagini", "Kaa"];

function createBot() {
    const id = 'bot-' + Math.floor(Math.random() * 1000000);
    const spawnPos = getSafeSpawnPosition();
    const rot = Math.random() * Math.PI * 2;
    players[id] = {
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
        name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
    };
    io.emit('newPlayer', players[id]);
}

function updateRotation(player) {
    if (player.targetRotation === undefined) return;
    
    let diff = player.targetRotation - player.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    const turnSpeed = 0.07; 
    
    if (Math.abs(diff) < turnSpeed) {
        player.rotation = player.targetRotation;
    } else {
        player.rotation += Math.sign(diff) * turnSpeed;
    }
}

function updateBotAI(bot) {
    // Simple AI: Find nearest food
    let nearestDist = Infinity;
    let targetX = bot.x;
    let targetY = bot.y;

    // Search for food
    Object.keys(food).forEach(fid => {
        const f = food[fid];
        const dx = f.x - bot.x;
        const dy = f.y - bot.y;
        const d = dx*dx + dy*dy;
        if (d < nearestDist) {
            nearestDist = d;
            targetX = f.x;
            targetY = f.y;
        }
    });

    // Calculate target angle
    bot.targetRotation = Math.atan2(targetY - bot.y, targetX - bot.x);

    // Boost if close to food and has score > 5
    if (nearestDist < 200*200 && bot.score > 5) {
        bot.isBoosting = true;
    } else {
        bot.isBoosting = false;
    }
}

function getPlayerScale(score) {
    let scale = 0.6 + (10 + score) * 0.005;
    if (scale > 1.2) scale = 1.2;
    return scale;
}

function getPlayerRadius(score) {
    return 15 * getPlayerScale(score);
}

setInterval(() => {
    const baseSpeed = 3; 
    const boostSpeed = 6; // Double speed when boosting
    const foodRadius = 10; 
    const segmentLength = 4;
    
    // Spawn Bots
    const currentBotCount = Object.values(players).filter(p => p.isBot).length;
    if (currentBotCount < BOT_COUNT) {
        if (Math.random() < 0.05) { // Don't spawn all at once
            createBot();
        }
    }

    // Update all players positions
    Object.keys(players).forEach(id => {
        const player = players[id];
        if (!player) return;

        if (player.isBot) {
            updateBotAI(player);
        }

        // Apply rotation smoothing for everyone (Bots AND Players)
        updateRotation(player);

        // Determine current speed
        let currentSpeed = baseSpeed;
        if (player.isBoosting && player.score > 2) { // Can only boost if length > 2
            currentSpeed = boostSpeed;
            
            // Burn mass logic
            // Decrease score every X frames? Or probabilistic?
            // Reduced from 0.05 (3/sec) to 0.02 (~1.2/sec) to make shrinking slower
            if (Math.random() < 0.02) {
                player.score = Math.max(0, player.score - 1);
                
                // Spawn food behind
                // Get position from end of path or just behind head?
                // Ideally behind tail, but path might be long.
                // Let's spawn behind head for simplicity or last path point
                const dropPos = player.path.length > 0 ? player.path[player.path.length - 1] : {x: player.x, y: player.y};
                
                const newFood = spawnFood(dropPos.x, dropPos.y, player.color); // Use player color?
                if (newFood) {
                    io.emit('newFood', newFood);
                }
            }
        }

        // Simple movement logic based on rotation
        // In a real implementation, this should match the client's physics exactly
        player.x += Math.cos(player.rotation) * currentSpeed;
        player.y += Math.sin(player.rotation) * currentSpeed;

        // Update Path for Body Collision
        player.path.unshift({x: player.x, y: player.y});
        // Limit path length based on score
        // Base length (head) + score * segmentLength + buffer
        const neededLength = (player.score + 10) * segmentLength + 20; 
        if (player.path.length > neededLength) {
            player.path.pop();
        }

        // 1. Check Collision with World Bounds
        if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
            killPlayer(id);
            return;
        }

        // 2. Check Collision with Other Snakes
        Object.keys(players).forEach(otherId => {
            if (id === otherId) return;
            const other = players[otherId];
            
            const myRadius = getPlayerRadius(player.score);
            const otherRadius = getPlayerRadius(other.score);

            // Check against other's body segments
            // We iterate through the path at intervals to simulate body segments
            // Start from index segmentLength (skip head area to avoid head-to-head instant death if close)
            for (let i = segmentLength; i < other.path.length; i += segmentLength) {
                const point = other.path[i];
                const dist = Math.hypot(player.x - point.x, player.y - point.y);
                if (dist < myRadius + otherRadius) { // Collision radius (Head radius + Body radius)
                     killPlayer(id);
                     return;
                }
            }
        });

        // Check collision with food
        Object.keys(food).forEach(foodId => {
            const f = food[foodId];
            const dx = player.x - f.x;
            const dy = player.y - f.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const myRadius = getPlayerRadius(player.score);

            if (distance < myRadius + foodRadius) {
                // Eat food
                delete food[foodId];
                player.score += 1; // Increase score/length
                
                // Emit event to remove food and update score
                // Use f.id to ensure we send a number, not the string key from Object.keys
                io.emit('foodEaten', { foodId: f.id, playerId: id, score: player.score });
                
                // Spawn new food
                const newFood = spawnFood();
                if (newFood) {
                    io.emit('newFood', newFood);
                }
            }
        });

        // Boundary checks (optional for now, but good to have)
        // Assuming world size is roughly 5000x5000 like in many .io games, 
        // or keep it small for testing. Let's wrap around for now or clamp.
        // For simplicity, let's just let them roam.
    });

    // Emit the updated state to all players
    io.emit('playerUpdates', players);
}, 1000 / 60);

function killPlayer(playerId) {
    const player = players[playerId];
    if (!player) return;

    console.log('Player died:', playerId);

    // Convert body to food
    // Iterate through path and spawn food
    const segmentLength = 4;
    // Spawn food every 2nd segment to avoid too much food
    for (let i = 0; i < player.path.length; i += segmentLength * 2) {
        const point = player.path[i];
        // Add some randomness to position
        const fx = point.x + (Math.random() * 20 - 10);
        const fy = point.y + (Math.random() * 20 - 10);
        
        const newFood = spawnFood(fx, fy); // Use player's color? Or random?
        if (newFood) {
            io.emit('newFood', newFood);
        }
    }

    // Remove player
    delete players[playerId];
    
    // Notify the dead player specifically (so they see Game Over)
    if (!player.isBot) {
        io.to(playerId).emit('playerDied', playerId);
    }
    
    // Notify everyone else that this player is gone (so they remove the snake)
    io.emit('playerDisconnected', playerId); 
}

server.listen(3000, function () {
    console.log('Listening on ' + server.address().port);
});
