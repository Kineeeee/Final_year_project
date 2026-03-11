const express = require('express');
const router = express.Router();
const AuthService = require('../auth/AuthService');
const UserQuiz = require('../../models/UserQuiz');
const RoomRegistry = require('./RoomRegistry');

// Simple auth middleware: expects Bearer token or token in body
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.body.token;
    const decoded = AuthService.verifyToken(token);
    if (!decoded) return res.status(401).json({ message: 'Unauthorized' });
    req.user = decoded;
    return next();
}

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
router.post('/custom/leave', async (req, res) => {
    try {
        const { code, socketId } = req.body || {};
        if (!code || !socketId) return res.status(400).json({ message: 'invalid_request' });
        const room = RoomRegistry.getRoom(code);
        if (!room) return res.status(404).json({ message: 'room_not_found' });
        const { ownerChanged, newOwnerId } = RoomRegistry.removeSocket(code, socketId);
        return res.json({ ownerChanged, newOwnerId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'server_error' });
    }
});

module.exports = router;
