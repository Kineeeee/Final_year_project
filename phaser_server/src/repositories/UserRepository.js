const User = require('../modules/auth/User');
const Logger = require('../utils/Logger');

class UserRepository {
    /**
     * Find a user by their username.
     * @param {string} username
     * @returns {Promise<Object|null>} User document or null
     */
    async findByUsername(username) {
        try {
            return await User.findOne({ username });
        } catch (error) {
            Logger.error('UserRepository', `Error finding user ${username}:`, error);
            throw error;
        }
    }

    /**
     * Update the high score for a user if the new score is higher.
     * @param {string} username
     * @param {number} newScore
     * @returns {Promise<Object|null>} Updated user document or null
     */
    async updateHighScore(username, newScore) {
        try {
            const user = await this.findByUsername(username);
            if (!user) return null;

            if (newScore > user.highScore) {
                user.highScore = newScore;
                await user.save();
                Logger.info('UserRepository', `Updated high score for ${username} to ${newScore}`);
                return user;
            }
            return user;
        } catch (error) {
            Logger.error('UserRepository', `Error updating high score for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Add coins to a user's balance.
     * @param {string} username
     * @param {number} amount
     * @returns {Promise<number>} New coin balance
     */
    async addCoins(username, amount) {
        try {
            // atomic update
            await User.findOneAndUpdate({ username }, { $inc: { coins: amount } });

            // fetch updated to return correct balance
            // (findOneAndUpdate can return new doc with {new: true} but logic below was two steps originally)
            // Sticking to separate fetch to match original logic precisely if needed,
            // OR use {new: true} which is better. Let's use {new: true} for optimization.
            const updatedUser = await User.findOneAndUpdate(
                { username },
                { $inc: { coins: 0 } } // No-op to just get the document? or just findOne.
                // Using findOne as per original code style might be safer to ensure consistency
            );

            // Check original code:
            // await User.findOneAndUpdate({ username: player.username }, { $inc: { coins: f.value } });
            // const updatedUser = await User.findOne({ username: player.username });

            // I will implement the efficient way:
            const result = await User.findOneAndUpdate(
                { username },
                { $inc: { coins: amount } },
                { new: true }
            );

            return result ? result.coins : 0;
        } catch (error) {
            Logger.error('UserRepository', `Error adding coins for ${username}:`, error);
            throw error;
        }
    }
}

module.exports = new UserRepository();
