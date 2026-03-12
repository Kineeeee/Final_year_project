function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value, { max = 128 } = {}) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > max) return null;
    return trimmed;
}

function asSafeColor(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const normalized = Math.floor(value);
    if (normalized < 0 || normalized > 0xffffff) return null;
    return normalized;
}

function validatePlayerInput(payload) {
    if (!isPlainObject(payload)) return null;

    const out = {};
    if (typeof payload.angle === 'number' && Number.isFinite(payload.angle)) {
        out.angle = payload.angle;
    }
    if (typeof payload.isBoosting === 'boolean') {
        out.isBoosting = payload.isBoosting;
    }

    if (!Object.prototype.hasOwnProperty.call(out, 'angle') &&
        !Object.prototype.hasOwnProperty.call(out, 'isBoosting')) {
        return null;
    }
    return out;
}

function validateInitPlayerPayload(payload) {
    if (!isPlainObject(payload)) return null;

    const out = {};
    const token = asTrimmedString(payload.token, { max: 4096 });
    if (token) out.token = token;

    const name = asTrimmedString(payload.name, { max: 64 });
    if (name) out.name = name;

    const quizSource = asTrimmedString(payload.quizSource, { max: 16 });
    if (quizSource) out.quizSource = quizSource;

    const color = asSafeColor(payload.color);
    if (color !== null) out.color = color;

    return out;
}

function validateEquipCosmeticPayload(payload) {
    if (!isPlainObject(payload)) return null;

    const rewardId = payload.rewardId;
    const category = asTrimmedString(payload.category, { max: 64 });

    const rewardOk = rewardId === null || asTrimmedString(rewardId, { max: 64 });
    if (!category || !rewardOk) return null;

    return {
        rewardId,
        category,
    };
}

function validateSocketId(value) {
    const socketId = asTrimmedString(value, { max: 128 });
    if (!socketId) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(socketId)) return null;
    return socketId;
}

function validateRoomCode(value) {
    const code = asTrimmedString(value, { max: 16 });
    if (!code) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
    return code;
}

module.exports = {
    isPlainObject,
    asTrimmedString,
    validatePlayerInput,
    validateInitPlayerPayload,
    validateEquipCosmeticPayload,
    validateSocketId,
    validateRoomCode,
};