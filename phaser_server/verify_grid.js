const GameServer = require('./src/GameServer');
const SpatialGrid = require('./src/core/SpatialGrid');
const Logger = require('./src/utils/Logger');

// Mock IO
const mockIO = {
    on: () => { },
    emit: () => { },
    sockets: { sockets: new Map() }
};

try {
    console.log('--- Verification: Spatial Grid ---');
    console.log('1. Testing SpatialGrid Class...');
    const grid = new SpatialGrid(1000, 100);
    grid.add({ id: 'p1', x: 50, y: 50 });
    const res = grid.query(50, 50, 10);
    if (res.size !== 1) throw new Error('Grid Query Failed');
    console.log('   [PASS] SpatialGrid Core Logic');

    console.log('2. Testing GameServer Initialization...');
    const server = new GameServer(mockIO, { mode: 'normal' });

    if (!server.spatialGrid) throw new Error('SpatialGrid not injected into GameServer');
    console.log('   [PASS] GameServer DI Injection');

    console.log('3. Testing Game Tick (Broadcast World Delta)...');
    // Add a fake player
    const socketId = 'p1';
    server.playerManager.addPlayer({ id: socketId, data: {} }, { x: 100, y: 100 });
    // Mock socket for broadcast
    mockIO.sockets.sockets.set(socketId, {
        id: socketId,
        data: { _interest: { players: new Set(), foods: new Set() } },
        emit: () => { }
    });

    server.networkSystem.broadcastWorldDelta({ serverTime: Date.now() });
    console.log('   [PASS] broadcastWorldDelta (with Grid Query)');

    console.log('--- VERIFICATION SUCCESS ---');
    process.exit(0);

} catch (err) {
    console.error('--- VERIFICATION FAILED ---');
    console.error(err);
    process.exit(1);
}
