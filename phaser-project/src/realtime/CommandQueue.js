import { COMMAND_TYPE } from './commands';

export class CommandQueue {
    constructor() {
        this._latestInput = null;
        this._useItemQueue = [];
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
            const { angle, isBoosting } = this._latestInput.payload;
            networkManager.sendPlayerInput(angle, isBoosting);
            this._latestInput = null;
        }

        if (this._useItemQueue.length) {
            for (const cmd of this._useItemQueue) {
                networkManager.sendUseItem(cmd.payload.itemId);
            }
            this._useItemQueue.length = 0;
        }
    }
}
