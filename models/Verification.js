import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    match: /^09\d{9}$/
  },
  code: {
    type: String,
    required: true,
  minlength: 6,
  maxlength: 6
  },
  type: {
    type: String,
    enum: ['verification', 'password_reset', 'login', 'register'],
    default: 'verification'
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    }
  }
}, {
  timestamps: true
});

// Auto-delete expired documents
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for quick lookups
verificationSchema.index({ mobile: 1, isUsed: 1, expiresAt: 1 });

export default mongoose.model('Verification', verificationSchema);
