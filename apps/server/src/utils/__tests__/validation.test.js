const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validatePlayerInput,
    validateInitPlayerPayload,
    validateEquipCosmeticPayload,
    validateSocketId,
    validateRoomCode,
} = require('../Validation');

test('validatePlayerInput accepts angle and boosting payload', () => {
    const input = { angle: 1.2, isBoosting: true };
    const validated = validatePlayerInput(input);
    assert.deepEqual(validated, input);
});

test('validatePlayerInput rejects non-object payload', () => {
    assert.equal(validatePlayerInput(null), null);
    assert.equal(validatePlayerInput('x'), null);
});

test('validateInitPlayerPayload strips unsupported fields and keeps safe ones', () => {
    const validated = validateInitPlayerPayload({
        token: 'abc',
        name: 'Player 1',
        quizSource: 'user',
        color: 255,
        hacked: 'drop',
    });

    assert.deepEqual(validated, {
        token: 'abc',
        name: 'Player 1',
        quizSource: 'user',
        color: 255,
    });
});

test('validateEquipCosmeticPayload accepts rewardId null for unequip', () => {
    const validated = validateEquipCosmeticPayload({ rewardId: null, category: 'skin' });
    assert.deepEqual(validated, { rewardId: null, category: 'skin' });
});

test('validateEquipCosmeticPayload rejects invalid category', () => {
    assert.equal(validateEquipCosmeticPayload({ rewardId: 'r1', category: '' }), null);
});

test('socket and room validators reject invalid characters', () => {
    assert.equal(validateSocketId('../id'), null);
    assert.equal(validateRoomCode('room*1'), null);
    assert.equal(validateSocketId('abc_123-XYZ'), 'abc_123-XYZ');
    assert.equal(validateRoomCode('ROOM_01'), 'ROOM_01');
});