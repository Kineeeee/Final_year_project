import { Logger } from '../../utils/Logger';

class PlayerState {
    constructor() {
        this.coins = parseInt(localStorage.getItem('coins') || '0', 10);
        this.highScore = parseInt(localStorage.getItem('highScore') || '0', 10);
        this.username = localStorage.getItem('username') || 'Guest';
        this.inventory = JSON.parse(localStorage.getItem('inventory') || '{}');
    }

    /**
     * Get current coin balance
     * @returns {number}
     */
    getCoins() {
        return this.coins;
    }

    /**
     * Set coin balance and update storage
     * @param {number} amount
     */
    setCoins(amount) {
        this.coins = amount;
        localStorage.setItem('coins', amount);

        // Keep window.userCoins for backward compatibility if other files still use it
        // but ideally we should remove all usages of window.userCoins
        window.userCoins = amount;

        Logger.debug('PlayerState', `Coins updated: ${amount}`);
    }

    /**
     * Add coins to balance
     * @param {number} amount
     */
    addCoins(amount) {
        this.setCoins(this.coins + amount);
    }

    /**
     * Get player high score
     * @returns {number}
     */
    getHighScore() {
        return this.highScore;
    }

    /**
     * Set high score if new score is higher
     * @param {number} score
     */
    setHighScore(score) {
        if (score > this.highScore) {
            this.highScore = score;
            localStorage.setItem('highScore', score);
            Logger.info('PlayerState', `New High Score: ${score}`);
            return true;
        }
        return false;
    }

    /**
     * Get username
     * @returns {string}
     */
    getUsername() {
        return this.username;
    }

    /**
     * Set username
     * @param {string} name
     */
    setUsername(name) {
        this.username = name;
        localStorage.setItem('username', name);
    }

    /**
     * Get inventory object
     * @returns {Object}
     */
    getInventory() {
        return this.inventory;
    }

    /**
     * Update inventory
     * @param {Object} inventory
     */
    setInventory(inventory) {
        this.inventory = inventory;
        localStorage.setItem('inventory', JSON.stringify(inventory));

        // Backward compatibility
        window.playerInventory = inventory;

        Logger.debug('PlayerState', 'Inventory updated');
    }

    /**
     * Check if player owns an item
     * @param {string} itemId
     * @returns {number} Quantity owned
     */
    getItemCount(itemId) {
        return this.inventory[itemId] || 0;
    }
    /**
     * Bulk update state from Auth response
     * @param {Object} data 
     */
    updateFromAuthData(data) {
        if (!data) return;

        if (data.username) this.setUsername(data.username);
        if (data.coins !== undefined) this.setCoins(data.coins);
        if (data.highScore !== undefined) this.setHighScore(data.highScore);

        // Handle Inventory
        if (data.inventory) {
            // Convert Array to Object if necessary (Server might send Array of objects {itemId, quantity})
            // Or Server sends Object. Let's handle both or assume Object if normalized.
            // AuthController currently sends: inventory: user.inventory (which is Array of {itemId, quantity})
            // PlayerState expects Object { itemId: quantity }

            let invObj = {};
            if (Array.isArray(data.inventory)) {
                data.inventory.forEach(item => {
                    // Item might be { itemId: "id", quantity: 5 }
                    // OR if populated { itemId: { _id: "...", name: "..." }, quantity: 5 }
                    // But we fixed User model to use String for itemId.
                    const id = typeof item.itemId === 'object' ? item.itemId._id || item.itemId.id : item.itemId;
                    invObj[id] = item.quantity;
                });
            } else {
                invObj = data.inventory;
            }
            this.setInventory(invObj);
        }

        if (data.color) {
            localStorage.setItem('preferredColor', data.color);
        }

        // Save Token
        if (data.token) {
            localStorage.setItem('token', data.token);
        }

        Logger.info('PlayerState', 'State synchronized from Auth Data');
    }
}

export const playerState = new PlayerState();
