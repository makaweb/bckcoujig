import mongoose from 'mongoose';

const vesselSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // شناسه کاربر
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  }
});

// ایندکس مکانی برای جستجوی نزدیک
vesselSchema.index({ location: '2dsphere' });

export default mongoose.model('Vessel', vesselSchema);
