import mongoose from "mongoose";

const boatTypeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    enum: ["قایق فایبرگلاس", "یکدار (قایق چوبی)", "لنج", "دیگر"]
  },
  name_en: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  typical_length_range: {
    min: Number, // متر
    max: Number
  },
  typical_crew_capacity: {
    min: Number,
    max: Number
  },
  fuel_efficiency: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  suitable_methods: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "FishingMethod" 
  }], // روش‌های صید مناسب
  maintenance_requirements: {
    frequency: String,
    estimated_cost: String,
    special_needs: [String]
  },
  custom_added_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  },
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

boatTypeSchema.index({ name: 1 });
boatTypeSchema.index({ custom_added_by: 1 });

const BoatType = mongoose.model("BoatType", boatTypeSchema);
export default BoatType;
