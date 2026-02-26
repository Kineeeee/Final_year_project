const Item = require('../../models/Item');
const User = require('../../models/User');
const Logger = require('../../utils/Logger');
const { ITEMS } = require('../../config/constants');

const Container = require('../../core/ServiceContainer');

class ShopManager {
    constructor(io, container) {
        this.io = io;
        this.container = container;
        // this.playerManager = playerManager; // Removed direct dependency
        this.shopItems = []; // Cache for shop items

        // Load Items from DB immediately
        this.loadShopItems();
    }

    get playerManager() {
        return this.container.get('playerManager');
    }

    async loadShopItems() {
        try {
            this.shopItems = await Item.find({});
            Logger.info(
                'ShopManager',
                `[DataSource] Loaded ${this.shopItems.length} items from MongoDB.`
            );
            this.shopItems.forEach((i) =>
                Logger.info(
                    'ShopManager',
                    `   - ${i.id}: Cooldown=${i.cooldown}, Buff=${i.buffValue}`
                )
            );
        } catch (e) {
            Logger.error('ShopManager', 'Failed to load items:', e);
        }
    }

    getShopItems() {
        return this.shopItems;
    }

    async handleBuyItem(playerId, itemId) {
        Logger.info('ShopManager', `handleBuyItem called for player ${playerId}, item: ${itemId}`);
        const players = this.playerManager.getAllPlayers();
        const player = players[playerId];

        if (!player) {
            Logger.warn('ShopManager', `Player not found: ${playerId}`);
            return;
        }

        // Fetch Item from DB (Single Source of Truth)
        let item;
        try {
            item = await Item.findOne({ id: itemId });
        } catch (e) {
            Logger.error('ShopManager', 'Error fetching item:', e);
        }

        if (!item) {
            // Fallback to constants if DB fails or empty, but prefer DB
            item = Object.values(ITEMS).find((i) => i.id === itemId);
            Logger.warn('ShopManager', 'Using fallback item config.');
        }

        if (!item) {
            Logger.warn('ShopManager', `Item not found: ${itemId}`);
            return;
        }

        // Re-check player existence after async operation
        if (!players[playerId]) {
            Logger.info('ShopManager', `Player ${playerId} disconnected during purchase.`);
            return;
        }

        Logger.info('ShopManager', `Price: ${item.price}`);

        if (player.coins >= item.price) {
            player.coins -= item.price;
            // Update Runtime State (Object)
            player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
            Logger.info('ShopManager', `Purchased. New Coins: ${player.coins}`);

            // Save to DB
            if (player.username && !player.username.startsWith('Guest_')) {
                try {
                    const user = await User.findOne({ username: player.username });
                    if (user) {
                        user.coins = player.coins;

                        // Sync Inventory Array
                        // Find if item exists in user.inventory (array)
                        // Note: user.inventory is a Mongoose Array of Subdocuments
                        const existingItem = user.inventory.find((i) => i.itemId === itemId);
                        if (existingItem) {
                            existingItem.quantity = player.inventory[itemId];
                        } else {
                            user.inventory.push({
                                itemId: itemId,
                                quantity: player.inventory[itemId],
                            });
                        }

                        // Mark as modified just in case
                        user.markModified('inventory');
                        await user.save();
                        Logger.info('ShopManager', 'User Data Saved Successfully.');
                    }
                } catch (err) {
                    Logger.error('ShopManager', 'Buy item DB error:', err);
                }
            }

            this.io.to(playerId).emit('updateCoins', player.coins);
            this.io.to(playerId).emit('updateInventory', player.inventory);
            // Also emit playerState for consistency
            this.io.to(playerId).emit('playerState', {
                coins: player.coins,
                inventory: player.inventory,
            });
        } else {
            Logger.info('ShopManager', `Not enough coins!`);
        }
    }

    handleUseItem(playerId, itemId) {
        const players = this.playerManager.getAllPlayers();
        const player = players[playerId];
        if (!player) return;

        if (player.inventory[itemId] > 0) {
            player.inventory[itemId]--;

            // Use cached shopItems for properties like duration
            let item = this.shopItems.find((i) => i.id === itemId);
            if (item) {
                // Logger.info('ShopManager', `[DataSource] Using DB Item: ${item.id} (Buff: ${item.buffValue})`);
            } else {
                item = ITEMS[itemId.toUpperCase()]; // Fallback to constant
                Logger.warn('ShopManager', `[DataSource] FALLBACK: Using Constant for ${itemId}`);
            }

            // Check Cooldown
            const now = Date.now();
            if (!player.lastItemUse) player.lastItemUse = {};
            const lastUse = player.lastItemUse[itemId] || 0;
            const cooldown = item.cooldown || 0;

            if (now - lastUse < cooldown + item.duration) {
                // Cooldown active, reject use (Give back item?)
                Logger.warn('ShopManager', `Item ${itemId} is on cooldown for player ${playerId}`);
                player.inventory[itemId]++; // Refund
                // Emit failure? For now just refund and return.
                return;
            }

            // Update Cooldown
            player.lastItemUse[itemId] = now;

            if (item) {
                // Set/Extend active effect
                player.activeEffects[itemId] = now + item.duration;
            }

            // Save to DB if logged in (inventory change)
            if (player.username && !player.username.startsWith('Guest_')) {
                User.findOne({ username: player.username })
                    .then((user) => {
                        if (user) {
                            if (!user.inventory) user.inventory = [];
                            const existingItem = user.inventory.find((i) => i.itemId === itemId);
                            if (existingItem) {
                                existingItem.quantity = player.inventory[itemId];
                            }
                            user.markModified('inventory');
                            return user.save();
                        }
                    })
                    .catch((err) => Logger.error('ShopManager', 'Use Item DB Error:', err));
            }

            this.io.to(playerId).emit('updateInventory', player.inventory);
            // Notify client of effect start (for visuals)
            if (item) {
                // BROADCAST to everyone so they see the effect
                this.io.emit('itemActivated', {
                    playerId: playerId,
                    itemId,
                    duration: item.duration,
                    buffValue: item.buffValue,
                    cooldown: item.cooldown,
                });
            }
        }
    }
}

module.exports = ShopManager;
