const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Encrypted
    coins: { type: Number, default: 0 },
    ownedSkins: { type: [String], default: ['default'] },
    currentSkin: { type: String, default: 'default' },
    color: { type: Number, default: null },
    highScore: { type: Number, default: 0 },
    // Inventory is an array of items
    inventory: {
        type: [
            {
                itemId: { type: String, required: true },
                quantity: { type: Number, default: 0 },
            },
        ],
        default: [],
    },
    refreshToken: { type: String, default: null }, // Store the latest refresh token
});

module.exports = mongoose.model('User', UserSchema);
