const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { 
        type: String, 
        required: function() {
            // Password is required only if both social IDs are missing
            return !this.googleId && !this.facebookId;
        }
    }, // Encrypted for local accounts
    email: { type: String, sparse: true, unique: true }, // Sparse allows multiple nulls
    googleId: { type: String, sparse: true, unique: true },
    facebookId: { type: String, sparse: true, unique: true },
    coins: { type: Number, default: 0 },
    ownedSkins: { type: [String], default: ['default'] },
    color: { type: Number, default: null },
    unlockedRewards: { type: [String], default: [] },
    equippedCosmetics: { type: Object, default: {} },
    highScore: { type: Number, default: 0 },
    // Inventory is an array of items
    inventory: {
        type: [
            {
                itemId: {
                    type: String,
                    required: true
                },
                quantity: { type: Number, default: 0 },
            },
        ],
        default: [],
    },
    refreshToken: { type: String, default: null }, // Store the latest refresh token
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
