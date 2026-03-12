const GAME_PHASE = Object.freeze({
    IDLE: 'IDLE',
    WAITING_ROOM: 'WAITING_ROOM',
    PLAYING: 'PLAYING',
    RESULT: 'RESULT',
    GAME_OVER: 'GAME_OVER',
    EXITING: 'EXITING',
    CLOSED: 'CLOSED',
});

const ROOM_LIFECYCLE = Object.freeze({
    CREATED: 'CREATED',
    WAITING: 'WAITING',
    STARTING: 'STARTING',
    PLAYING: 'PLAYING',
    RESULT: 'RESULT',
    CLOSED: 'CLOSED',
});

module.exports = {
    GAME_PHASE,
    ROOM_LIFECYCLE,
};
