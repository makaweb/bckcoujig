import mongoose from "mongoose";

const crewMemberSchema = new mongoose.Schema({
  boat_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Boat", 
    required: true 
  },
  national_code: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    required: true,
    enum: ['captain', 'sailor', 'engineer', 'cook', 'other']
  },
  share_percentage: { 
    type: Number, 
    default: 0.0 
  },
  assignment_date: { 
    type: String, 
    required: true 
  },
  end_date: { 
    type: String, 
    default: null 
  },
  is_active: { 
    type: Number, 
    default: 1 
  },
  notes: { 
    type: String, 
    default: null 
  },
  owner_id: {
    type: String, // National code of owner
    required: true
  },
  synced: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// ایندکس‌ها
crewMemberSchema.index({ boat_id: 1 });
crewMemberSchema.index({ national_code: 1 });
crewMemberSchema.index({ role: 1 });
crewMemberSchema.index({ owner_id: 1 });
crewMemberSchema.index({ is_active: 1 });

// اطمینان از اینکه یک نفر نمی‌تواند دوبار به یک قایق اضافه شود
crewMemberSchema.index({ boat_id: 1, national_code: 1 }, { unique: true });

const CrewMember = mongoose.model("CrewMember", crewMemberSchema);
export default CrewMember;
