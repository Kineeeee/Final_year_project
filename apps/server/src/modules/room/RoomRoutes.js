const express = require('express');
const router = express.Router();
const requireAuth = require('../auth/http/RequireAuthMiddleware');
const UserQuiz = require('../../models/UserQuiz');
const RoomRegistry = require('./RoomRegistry');
const { validateRoomCode } = require('../../utils/Validation');

router.post('/custom', requireAuth, async (req, res) => {
    try {
        if (RoomRegistry.rooms.size >= RoomRegistry.maxCustomRooms) {
            return res.status(429).json({ message: 'custom_rooms_maxed' });
        }
        const category = (req.body.category || '').toLowerCase();
        if (!['math', 'english'].includes(category)) {
            return res.status(400).json({ message: 'invalid_category' });
        }

        const quizDoc = await UserQuiz.findOne({
            userId: req.user.userId,
            category,
            isValid: true,
        });
        if (!quizDoc) {
            return res.status(400).json({ message: 'quiz_not_found' });
        }

        const { code } = RoomRegistry.createRoom({
            ownerUserId: req.user.userId,
            ownerId: null,
            category,
            quizDoc,
        });

        return res.json({
            code,
            namespace: `/custom/${code}`,
            category,
            type: 'custom',
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'server_error' });
    }
});

router.get('/meta/:code', async (req, res) => {
    const code = req.params.code;
    const meta = RoomRegistry.getMeta(code);
    if (!meta) return res.status(404).json({ message: 'room_not_found' });
    
    // Check if room has already started to prevent mid-game joins
    if (meta.started) {
        return res.status(403).json({ message: 'room_already_started' });
    }
    
    return res.json(meta);
});

// List active custom rooms
router.get('/custom/list', async (_req, res) => {
    try {
        const rooms = RoomRegistry.listRooms();
        return res.json({
            rooms,
            capacity: {
                max: RoomRegistry.maxCustomRooms,
                current: RoomRegistry.rooms.size,
                available: Math.max(RoomRegistry.maxCustomRooms - RoomRegistry.rooms.size, 0),
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'server_error' });
    }
});

// Leave lobby (graceful exit from custom room)
router.post('/custom/leave', requireAuth, async (req, res) => {
    try {
        const { code } = req.body || {};
        const safeCode = validateRoomCode(code);
        if (!safeCode) return res.status(400).json({ message: 'invalid_request' });

        const socketId = RoomRegistry.getSocketByUser(req.user.userId);
        if (!socketId) return res.status(404).json({ message: 'socket_not_found' });

        const room = RoomRegistry.getRoom(safeCode);
        if (!room) return res.status(404).json({ message: 'room_not_found' });

        // Only allow leaving your own active room membership.
        if (!room.sockets.has(socketId)) {
            return res.status(403).json({ message: 'not_in_room' });
        }

        const { ownerChanged, newOwnerId } = RoomRegistry.removeSocket(safeCode, socketId);
        return res.json({ ownerChanged, newOwnerId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'server_error' });
    }
});

module.exports = router;
