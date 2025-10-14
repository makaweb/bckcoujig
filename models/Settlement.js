import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema({
  settlement_number: { 
    type: String, 
    required: true,
    unique: true
  },
  boat_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Boat", 
    required: true 
  },
  user_national_code: { 
    type: String, 
    required: true 
  },
  user_role: { 
    type: String, 
    required: true,
    enum: ['sailor', 'captain', 'owner']
  },
  period_start: { 
    type: String, 
    required: true 
  },
  period_end: { 
    type: String, 
    required: true 
  },
  total_income: { 
    type: Number, 
    default: 0.0 
  },
  share_percentage: { 
    type: Number, 
    default: 0.0 
  },
  share_amount: { 
    type: Number, 
    default: 0.0 
  },
  expenses: { 
    type: Number, 
    default: 0.0 
  },
  net_amount: { 
    type: Number, 
    default: 0.0 
  },
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'confirmed_by_user', 'confirmed_by_owner', 'paid', 'rejected']
  },
  confirmed_by_user_at: { 
    type: String, 
    default: null 
  },
  confirmed_by_owner_at: { 
    type: String, 
    default: null 
  },
  payment_date: { 
    type: String, 
    default: null 
  },
  payment_method: { 
    type: String, 
    default: null,
    enum: [null, 'cash', 'bank_transfer', 'check']
  },
  payment_reference: { 
    type: String, 
    default: null 
  },
  notes: { 
    type: String, 
    default: null 
  },
  synced: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// ایندکس‌ها
settlementSchema.index({ boat_id: 1 });
settlementSchema.index({ user_national_code: 1 });
settlementSchema.index({ status: 1 });
settlementSchema.index({ period_start: 1, period_end: 1 });
settlementSchema.index({ settlement_number: 1 }, { unique: true });

const Settlement = mongoose.model("Settlement", settlementSchema);
export default Settlement;
