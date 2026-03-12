const User = require('../models/User');
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
    /**
     * Unlock a reward for a user if they don't already have it.
     * @param {string} username
     * @param {string} rewardId
     */
    async unlockReward(username, rewardId) {
        try {
            const result = await User.findOneAndUpdate(
                { username },
                { $addToSet: { unlockedRewards: rewardId } },
                { new: true }
            );
            return result ? result.unlockedRewards : [];
        } catch (error) {
            Logger.error('UserRepository', `Error unlocking reward for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Replaces the currently equipped cosmetic in a given category.
     * @param {string} username
     * @param {string} category (e.g., 'skin', 'trail', 'theme')
     * @param {string} rewardId
     */
    async equipCosmetic(username, category, rewardId) {
        try {
            const updateObj = {};
            updateObj[`equippedCosmetics.${category}`] = rewardId;
            
            const result = await User.findOneAndUpdate(
                { username },
                { $set: updateObj },
                { new: true }
            );
            return result ? result.equippedCosmetics : {};
        } catch (error) {
            Logger.error('UserRepository', `Error equipping cosmetic for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Replaces the entire equipped cosmetics loadout
     * @param {string} username
     * @param {Object} cosmeticsObj (e.g., { skin: '...', trail: '...' })
     */
    async updateEquippedCosmetics(username, cosmeticsObj) {
        try {
            const result = await User.findOneAndUpdate(
                { username },
                { $set: { equippedCosmetics: cosmeticsObj } },
                { new: true }
            );
            return result ? result.equippedCosmetics : {};
        } catch (error) {
            Logger.error('UserRepository', `Error saving cosmetics loadout for ${username}:`, error);
            throw error;
        }
    }
}

module.exports = new UserRepository();
