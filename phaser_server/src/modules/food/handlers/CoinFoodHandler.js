const Logger = require('../../../utils/Logger');
const UserRepository = require('../../../repositories/UserRepository');

class CoinFoodHandler {
    constructor(container) {
        this.container = container;
    }

    get io() { return this.container.get('io'); }

    async consume(player, food) {
        // Coin Logic
        // Effect: Add Coins to Player (DB or Local)

        if (!player.isBot) {
            try {
                if (player.username && !player.username.startsWith('Guest_')) {
                    // Logged in User: Update DB
                    const newBalance = await UserRepository.addCoins(player.username, food.value);

                    // Direct feedback to client
                    if (this.io) {
                        this.io.to(player.playerId).emit('updateCoins', newBalance);
                    }
                    player.coins = newBalance; // Sync local state
                } else {
                    // Guest: Update Local State
                    let currentCoins = parseInt(player.coins) || 0;
                    player.coins = currentCoins + food.value;

                    if (this.io) {
                        this.io.to(player.playerId).emit('updateCoins', player.coins);
                    }
                }
            } catch (err) {
                Logger.error('CoinFoodHandler', 'Error updating coins:', err);
            }
        }

        // Return result
        // Coins do NOT trigger immediate generic respawn in current logic
        return {
            eaten: true,
            shouldRespawn: false,
            score: player.score, // Score doesn't change
            type: food.type
        };
    }
}

module.exports = CoinFoodHandler;
