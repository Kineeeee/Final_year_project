const crypto = require('crypto');
const Logger = require('../../utils/Logger');
const { ROOM_LIFECYCLE } = require('../../core/GamePhases');

class RoomRegistry {
    constructor() {
        this.rooms = new Map(); // code -> room data
        this.maxCustomRooms = 10;
        this.emptyTtlMs = 5 * 60 * 1000; // close after 5m empty
        this.joinGraceMs = 2 * 60 * 1000; // close if nobody joins within 2m
        this.userSocketMap = new Map(); // userId -> socketId
        this.socketUserMap = new Map(); // socketId -> userId
        this.maxRoomPlayers = 30;
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
            lifecycle: ROOM_LIFECYCLE.CREATED,
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

    canAcceptJoin(code) {
        const room = this.rooms.get(code);
        if (!room) return false;

        // Only allow lobby joins while room is not in an active/terminal state.
        const lifecycleJoinable =
            room.lifecycle === ROOM_LIFECYCLE.CREATED ||
            room.lifecycle === ROOM_LIFECYCLE.WAITING;
        if (!lifecycleJoinable) return false;

        if (room.gameServer?.matchStarted) return false;
        if ((room.sockets?.size || 0) >= this.maxRoomPlayers) return false;

        return true;
    }

    addSocket(code, socketId) {
        const room = this.rooms.get(code);
        if (!room) return false;
        if (!this.canAcceptJoin(code)) return false;
        room.sockets.add(socketId);
        room.lastActive = Date.now();
        if (room.lifecycle === ROOM_LIFECYCLE.CREATED) {
            room.lifecycle = ROOM_LIFECYCLE.WAITING;
        }
        if (!room.ownerId) room.ownerId = socketId;
        if (room.joinGraceTimer) {
            clearTimeout(room.joinGraceTimer);
            room.joinGraceTimer = null;
        }
        if (room.closeTimer) {
            clearTimeout(room.closeTimer);
            room.closeTimer = null;
        }
        return true;
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
            room.lifecycle = ROOM_LIFECYCLE.CLOSED;
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
        const started = !!(room.gameServer && room.gameServer.matchStarted);
        return {
            code: room.code,
            type: room.type,
            lifecycle: room.lifecycle,
            category: room.category,
            ownerUserId: room.ownerUserId,
            ownerId: room.ownerId,
            players: room.sockets.size,
            capacity: 30,
            createdAt: room.createdAt,
            lastActive: room.lastActive,
            started,
            joinable: this.canAcceptJoin(code),
        };
    }

    setLifecycle(code, lifecycle) {
        const room = this.rooms.get(code);
        if (!room) return;
        room.lifecycle = lifecycle;
        room.lastActive = Date.now();
    }

    listRooms() {
        return Array.from(this.rooms.values()).map((room) => this.getMeta(room.code));
    }

    setUserSocket(userId, socketId) {
        if (!userId || !socketId) return;
        const key = String(userId);
        this.userSocketMap.set(key, socketId);
        this.socketUserMap.set(socketId, key);
    }

    getSocketByUser(userId) {
        if (!userId) return null;
        return this.userSocketMap.get(String(userId)) || null;
    }

    clearSocketUser(socketId) {
        if (!socketId) return;
        const userId = this.socketUserMap.get(socketId);
        if (!userId) return;
        const mapped = this.userSocketMap.get(userId);
        if (mapped === socketId) {
            this.userSocketMap.delete(userId);
        }
        this.socketUserMap.delete(socketId);
    }
}

module.exports = new RoomRegistry();
