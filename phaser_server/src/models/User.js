const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Đã mã hóa
  coins: { type: Number, default: 0 }, // Tiền để mua skin
  ownedSkins: { type: [String], default: ['default'] }, // Danh sách skin đã mua
  currentSkin: { type: String, default: 'default' }, // Skin đang dùng
  highScore: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', UserSchema);