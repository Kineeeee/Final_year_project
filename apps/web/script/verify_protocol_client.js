import { io } from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';

const socket = io('http://localhost:3000', {
    parser,
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ Connected to Server');
    socket.emit('initPlayer', { name: "DebugBot", color: 0xFF0000 });
});

socket.on('worldDelta', (delta) => {
    console.log('✅ Received worldDelta:', delta);
    // process.exit(0); // Don't exit immediately, let it flood a bit
});

socket.on('currentPlayers', (players) => {
    console.log('✅ Received currentPlayers:', Object.keys(players).length);
});

socket.on('playerUpdates', (updates) => {
    console.log('✅ Received playerUpdates (Legacy Heartbeat)');
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.log('ℹ️ Timeout waiting for packets');
    process.exit(0);
}, 5000);
