export const COMMAND_TYPE = {
    PLAYER_INPUT: 'PLAYER_INPUT',
    USE_ITEM: 'USE_ITEM',
};

export function createPlayerInputCommand({ angle, isBoosting, ts }) {
    return {
        type: COMMAND_TYPE.PLAYER_INPUT,
        ts,
        payload: { angle, isBoosting },
    };
}

export function createUseItemCommand({ itemId, ts }) {
    return {
        type: COMMAND_TYPE.USE_ITEM,
        ts,
        payload: { itemId },
    };
}
