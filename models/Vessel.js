const mongoose = require('mongoose');

const vesselSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // شناسه کاربر
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vessel', vesselSchema);
