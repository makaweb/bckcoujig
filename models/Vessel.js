import mongoose from 'mongoose';

const vesselSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Vessel', vesselSchema);
