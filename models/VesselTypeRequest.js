const mongoose = require('mongoose');

const vesselTypeRequestSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true 
  },
  userName: { 
    type: String, 
    default: '' 
  },
  requestedTypeName: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending' 
  },
  adminNote: { 
    type: String, 
    default: '' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
vesselTypeRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('VesselTypeRequest', vesselTypeRequestSchema);