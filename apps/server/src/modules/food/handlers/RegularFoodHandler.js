const Logger = require('../../../utils/Logger');

class RegularFoodHandler {
    constructor(container) {
        this.container = container;
    }
    async consume(player, food) {
        // Regular Food Logic
        // Effect: Increase Score
        await this.container.get('playerManager').updatePlayerScore(player, 1);

        // Return result indicating what needs to happen next
        return {
            eaten: true,
            shouldRespawn: true,
            score: player.score,
            type: food.type,
        };
    }
}

module.exports = RegularFoodHandler;
