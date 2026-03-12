const test = require('node:test');
const assert = require('node:assert/strict');
const RoomRegistry = require('../RoomRegistry');
const { ROOM_LIFECYCLE } = require('../../../core/GamePhases');

test('RoomRegistry lifecycle transitions created -> waiting -> closed', () => {
    const { code } = RoomRegistry.createRoom({
        ownerId: null,
        ownerUserId: 'u1',
        category: 'math',
        quizDoc: { _id: 'q1' },
    });

    const room = RoomRegistry.getRoom(code);
    assert.equal(room.lifecycle, ROOM_LIFECYCLE.CREATED);

    RoomRegistry.addSocket(code, 's1');
    assert.equal(RoomRegistry.getRoom(code).lifecycle, ROOM_LIFECYCLE.WAITING);

    RoomRegistry.removeSocket(code, 's1');
    assert.equal(RoomRegistry.getRoom(code).lifecycle, ROOM_LIFECYCLE.CLOSED);

    RoomRegistry.closeRoom(code, 'test_cleanup');
});

test('RoomRegistry user socket mapping set/get/clear', () => {
    RoomRegistry.setUserSocket('user-abc', 'socket-abc');
    assert.equal(RoomRegistry.getSocketByUser('user-abc'), 'socket-abc');

    RoomRegistry.clearSocketUser('socket-abc');
    assert.equal(RoomRegistry.getSocketByUser('user-abc'), null);
});

test('RoomRegistry addSocket rejects joins when lifecycle is not joinable', () => {
    const { code } = RoomRegistry.createRoom({
        ownerId: null,
        ownerUserId: 'u2',
        category: 'english',
        quizDoc: { _id: 'q2' },
    });

    assert.equal(RoomRegistry.canAcceptJoin(code), true);
    assert.equal(RoomRegistry.addSocket(code, 's2'), true);

    RoomRegistry.setLifecycle(code, ROOM_LIFECYCLE.PLAYING);
    assert.equal(RoomRegistry.canAcceptJoin(code), false);
    assert.equal(RoomRegistry.addSocket(code, 's3'), false);

    RoomRegistry.setLifecycle(code, ROOM_LIFECYCLE.CLOSED);
    assert.equal(RoomRegistry.canAcceptJoin(code), false);
    assert.equal(RoomRegistry.addSocket(code, 's4'), false);

    RoomRegistry.closeRoom(code, 'test_cleanup_non_joinable');
});

test('RoomRegistry canAcceptJoin blocks started game server rooms', () => {
    const { code } = RoomRegistry.createRoom({
        ownerId: null,
        ownerUserId: 'u3',
        category: 'math',
        quizDoc: { _id: 'q3' },
    });

    const room = RoomRegistry.getRoom(code);
    room.gameServer = { matchStarted: true };
    assert.equal(RoomRegistry.canAcceptJoin(code), false);
    assert.equal(RoomRegistry.addSocket(code, 's5'), false);

    RoomRegistry.closeRoom(code, 'test_cleanup_started');
});
