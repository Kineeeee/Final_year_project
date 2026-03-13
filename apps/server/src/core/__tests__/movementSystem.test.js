const test = require('node:test');
const assert = require('node:assert');
const MovementSystem = require('../systems/MovementSystem');
const { TURN_SPEED } = require('../../config/ServerConstants');

const dummyContainer = {
    get() {
        return null;
    },
};

test('MovementSystem rotates toward target at capped turn speed', () => {
    const system = new MovementSystem(dummyContainer);
    const player = { rotation: 0, targetRotation: Math.PI / 2 };

    system.updateRotation(player);
    assert.ok(
        Math.abs(player.rotation - TURN_SPEED) < 1e-6,
        'rotation should advance by TURN_SPEED toward target'
    );
});

test('MovementSystem snaps when within turn speed threshold', () => {
    const system = new MovementSystem(dummyContainer);
    const player = { rotation: 0, targetRotation: TURN_SPEED / 2 };

    system.updateRotation(player);
    assert.strictEqual(player.rotation, player.targetRotation);
});
