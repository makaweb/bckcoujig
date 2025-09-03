import mongoose from "mongoose";

const fishingToolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  name_en: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  category: {
    type: String,
    enum: ["net", "hook", "trap", "electronic", "mechanical", "other"],
    required: true
  },
  compatible_methods: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "FishingMethod" 
  }], // روش‌های صید سازگار
  specifications: {
    size: String,
    material: String,
    weight: String,
    capacity: String,
    other: String
  },
  maintenance_required: { 
    type: Boolean, 
    default: false 
  },
  maintenance_interval_days: { 
    type: Number, 
    default: null 
  },
  custom_added_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  }, // اگر توسط مالک اضافه شده
  is_active: { 
    type: Boolean, 
    default: true 
  },
  approval_status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"],
    default: "approved"
  }
}, { timestamps: true });

// ایندکس‌ها
fishingToolSchema.index({ name: 1 });
fishingToolSchema.index({ category: 1 });
fishingToolSchema.index({ custom_added_by: 1 });
fishingToolSchema.index({ compatible_methods: 1 });

const FishingTool = mongoose.model("FishingTool", fishingToolSchema);
export default FishingTool;
