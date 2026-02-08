import { COMMAND_TYPE } from './commands';

export class CommandQueue {
    constructor() {
        this._latestInput = null;
        this._useItemQueue = [];
        this.lastInputTime = 0;
        this.throttleMs = 33; // ~30Hz
    }

    enqueue(command) {
        if (!command) return;

        if (command.type === COMMAND_TYPE.PLAYER_INPUT) {
            // Keep only the latest input for the current frame
            this._latestInput = command;
            return;
        }

        if (command.type === COMMAND_TYPE.USE_ITEM) {
            this._useItemQueue.push(command);
        }
    }

    flush({ networkManager } = {}) {
        if (!networkManager) return;

        if (this._latestInput) {
            const now = Date.now();
            // Throttle to ~30Hz (33ms)
            if (now - this.lastInputTime >= this.throttleMs) {
                const { angle, isBoosting } = this._latestInput.payload;
                networkManager.sendPlayerInput(angle, isBoosting);
                this._latestInput = null;
                this.lastInputTime = now;
            }
        }

        if (this._useItemQueue.length) {
            for (const cmd of this._useItemQueue) {
                networkManager.sendUseItem(cmd.payload.itemId);
            }
            this._useItemQueue.length = 0;
        }
    }
}
