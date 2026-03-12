const test = require('node:test');
const assert = require('node:assert/strict');
const QuizManager = require('../QuizManager');
const { GAME_PHASE } = require('../../../core/GamePhases');

test('QuizManager.endRound emits result and roundEnd and sets RESULT phase', () => {
    const emitted = [];
    const io = {
        emit: (event, payload) => emitted.push([event, payload]),
    };

    const fakeGameServer = {
        matchStarted: true,
        phase: GAME_PHASE.PLAYING,
        config: { isCustom: false },
    };

    const fakePlayerManager = {
        getAllPlayers: () => ({
            p1: { id: 'p1', name: 'A', correctAnswers: 4, score: 100 },
            p2: { id: 'p2', name: 'B', correctAnswers: 2, score: 30 },
        }),
        killAllPlayers: () => {},
    };

    const container = {
        has: (name) => name === 'gameServer',
        get: (name) => {
            if (name === 'gameServer') return fakeGameServer;
            if (name === 'playerManager') return fakePlayerManager;
            if (name === 'foodManager') return { getAllFood: () => ({}) };
            throw new Error(`Unexpected container key: ${name}`);
        },
    };

    const qm = new QuizManager(io, container, 'math', { isCustom: false });
    qm.isActive = true;
    qm.startRound = () => {};

    const originalSetTimeout = global.setTimeout;
    const scheduled = [];
    global.setTimeout = (fn) => {
        scheduled.push(fn);
        return scheduled.length;
    };

    try {
        qm.endRound();
    } finally {
        global.setTimeout = originalSetTimeout;
    }

    assert.equal(fakeGameServer.phase, GAME_PHASE.RESULT);
    assert.ok(emitted.some(([evt]) => evt === 'result'));
    assert.ok(emitted.some(([evt]) => evt === 'roundEnd'));
});
