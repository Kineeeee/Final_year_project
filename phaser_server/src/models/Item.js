const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // e.g., 'speed', 'magnet'
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    type: { type: String, enum: ['consumable', 'skin', 'upgrade'], default: 'consumable' },
    duration: { type: Number, default: 0 }, // For effects (ms)
    cooldown: { type: Number, default: 0 }, // Cooldown in ms
    buffValue: { type: Number, default: 0 }, // Magnitude of effect (speed, radius)
    iconColor: { type: String }, // Hex string for usage in client
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);
