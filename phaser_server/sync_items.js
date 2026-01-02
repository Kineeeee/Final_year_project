const mongoose = require('mongoose');
const { ITEMS } = require('./src/config/constants');
const Item = require('./src/models/Item');
const connectDB = require('./src/config/db');
const Logger = require('./src/utils/Logger');

const syncItems = async () => {
    await connectDB();
    Logger.info('Sync', 'Connected to Database. Syncing Items...');

    const itemsToSync = Object.values(ITEMS);

    for (const itemData of itemsToSync) {
        try {
            await Item.findOneAndUpdate(
                { id: itemData.id },
                itemData,
                { upsert: true, new: true }
            );
            Logger.info('Sync', `Synced Item: ${itemData.id} (Buff: ${itemData.buffValue})`);
        } catch (error) {
            Logger.error('Sync', `Failed to sync ${itemData.id}:`, error);
        }
    }

    Logger.info('Sync', 'Sync Complete. You can now restart the server.');
    process.exit(0);
};

syncItems();
