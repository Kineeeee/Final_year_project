export const GAME_PHASE = Object.freeze({
    IDLE: 'IDLE',
    WAITING_ROOM: 'WAITING_ROOM',
    PLAYING: 'PLAYING',
    RESULT: 'RESULT',
    GAME_OVER: 'GAME_OVER',
    EXITING: 'EXITING',
});

const ALLOWED = Object.freeze({
    [GAME_PHASE.IDLE]: new Set([GAME_PHASE.WAITING_ROOM, GAME_PHASE.PLAYING, GAME_PHASE.EXITING]),
    [GAME_PHASE.WAITING_ROOM]: new Set([GAME_PHASE.PLAYING, GAME_PHASE.EXITING]),
    [GAME_PHASE.PLAYING]: new Set([GAME_PHASE.RESULT, GAME_PHASE.GAME_OVER, GAME_PHASE.EXITING]),
    [GAME_PHASE.RESULT]: new Set([GAME_PHASE.PLAYING, GAME_PHASE.GAME_OVER, GAME_PHASE.EXITING]),
    [GAME_PHASE.GAME_OVER]: new Set([GAME_PHASE.IDLE, GAME_PHASE.EXITING]),
    [GAME_PHASE.EXITING]: new Set([GAME_PHASE.IDLE]),
});

export function canTransitionPhase(from, to) {
    if (!from || !to) return false;
    if (from === to) return true;
    return ALLOWED[from]?.has(to) || false;
}
