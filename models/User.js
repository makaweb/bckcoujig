import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    unique: true,
    match: /^09\d{9}$/
  },
  nationalCode: {
    type: String,
    required: true,
    unique: true,
    length: 10
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null, // URL یا path به عکس آواتار
    trim: true
  },
  role: {
    type: String,
    enum: ['owner', 'captain', 'sailor', 'engineer', 'cook'],
    default: 'owner'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String, // national code of creator
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  passwordHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ mobile: 1 });
userSchema.index({ nationalCode: 1 });
userSchema.index({ createdBy: 1 });
userSchema.index({ role: 1 });

// Middleware to update updatedAt before save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('User', userSchema);
