const crypto = require('crypto');
const Logger = require('../../utils/Logger');

class RoomRegistry {
    constructor() {
        this.rooms = new Map(); // code -> room data
        this.maxCustomRooms = 2;
        this.emptyTtlMs = 5 * 60 * 1000; // close after 5m empty
        this.joinGraceMs = 2 * 60 * 1000; // close if nobody joins within 2m
    }

    generateCode() {
        return crypto.randomBytes(4).toString('hex'); // 8 hex chars
    }

    createRoom({ ownerId, ownerUserId, category, quizDoc }) {
        if (this.rooms.size >= this.maxCustomRooms) {
            return { error: 'custom_rooms_maxed' };
        }
        let code;
        do {
            code = this.generateCode();
        } while (this.rooms.has(code));

        const room = {
            code,
            type: 'custom',
            ownerId,
            ownerUserId,
            category,
            quizDoc,
            createdAt: Date.now(),
            lastActive: Date.now(),
            sockets: new Set(),
            closeTimer: null,
            joinGraceTimer: null,
        };
        this.rooms.set(code, room);
        Logger.info('RoomRegistry', `Created custom room ${code} for user ${ownerUserId || 'unknown'}`);

        // Auto-close if creator never joins
        room.joinGraceTimer = setTimeout(() => {
            const r = this.rooms.get(code);
            if (!r) return;
            if (!r.sockets || r.sockets.size === 0) {
                this.closeRoom(code, 'join_timeout');
            }
        }, this.joinGraceMs);

        return { code, room };
    }

    getRoom(code) {
        return this.rooms.get(code);
    }

    addSocket(code, socketId) {
        const room = this.rooms.get(code);
        if (!room) return;
        room.sockets.add(socketId);
        room.lastActive = Date.now();
        if (!room.ownerId) room.ownerId = socketId;
        if (room.joinGraceTimer) {
            clearTimeout(room.joinGraceTimer);
            room.joinGraceTimer = null;
        }
        if (room.closeTimer) {
            clearTimeout(room.closeTimer);
            room.closeTimer = null;
        }
    }

    removeSocket(code, socketId) {
        const room = this.rooms.get(code);
        if (!room) return { ownerChanged: false };
        room.sockets.delete(socketId);
        room.lastActive = Date.now();
        let ownerChanged = false;
        let newOwnerId = room.ownerId;
        if (room.ownerId === socketId) {
            room.ownerId = Array.from(room.sockets)[0] || null;
            ownerChanged = true;
            newOwnerId = room.ownerId;
        }
        if (room.sockets.size === 0) {
            room.closeTimer = setTimeout(() => this.closeRoom(code, 'empty_timeout'), this.emptyTtlMs);
        }
        return { ownerChanged, newOwnerId };
    }

    closeRoom(code, reason = 'closed') {
        const room = this.rooms.get(code);
        if (!room) return;
        if (room.closeTimer) clearTimeout(room.closeTimer);
        if (room.joinGraceTimer) clearTimeout(room.joinGraceTimer);
        if (room.gameServer && typeof room.gameServer.destroy === 'function') {
            room.gameServer.destroy();
        }
        this.rooms.delete(code);
        Logger.info('RoomRegistry', `Room ${code} closed (${reason})`);
    }

    getMeta(code) {
        const room = this.rooms.get(code);
        if (!room) return null;
        return {
            code: room.code,
            type: room.type,
            category: room.category,
            ownerUserId: room.ownerUserId,
            ownerId: room.ownerId,
            players: room.sockets.size,
            capacity: 30,
            createdAt: room.createdAt,
            lastActive: room.lastActive,
            started: !!(room.gameServer && room.gameServer.matchStarted),
        };
    }

    listRooms() {
        return Array.from(this.rooms.values()).map((room) => this.getMeta(room.code));
    }
}

module.exports = new RoomRegistry();
