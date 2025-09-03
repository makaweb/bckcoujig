import mongoose from "mongoose";
import moment from "moment-jalaali";

const boatSchema = new mongoose.Schema({
  boat_name: { type: String, required: true },
  boat_code: { type: String, required: true }, // حذف unique از اینجا
  boat_type_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "BoatType", 
    required: true 
  },
  fishing_method_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "FishingMethod", 
    required: true 
  },
  length: { type: Number, default: null }, // متر
  width: { type: Number, default: null }, // متر
  engine_power: { type: Number, default: null }, // اسب بخار
  fuel_capacity: { type: Number, default: null }, // لیتر
  crew_capacity: { type: Number, default: null },
  
  // مشخصات مالکیت
  owner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  captain_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  },
  
  // مستندات و تصاویر
  documents: { type: String, default: null },
  boat_image: { type: String, default: null },
  license_number: { type: String, default: null },
  insurance_info: {
    company: String,
    policy_number: String,
    expiry_date: String,
    coverage_amount: Number
  },
  
  // تاریخ‌ها
  registration_date: { 
    type: String, 
    default: moment().format("jYYYY-jMM-jDD") 
  },
  last_inspection_date: { type: String, default: null },
  next_inspection_due: { type: String, default: null },
  
  // وضعیت
  status: { 
    type: String, 
    enum: ["pending", "active", "inactive", "maintenance", "retired"],
    default: "pending" 
  },
  
  // ابزارهای نصب شده
  installed_tools: [{
    tool_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "FishingTool" 
    },
    installation_date: String,
    condition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good"
    },
    last_maintenance: String,
    notes: String
  }],
  
  // هزینه‌ها و اقتصادی
  operating_costs: {
    daily_fuel_cost: Number,
    maintenance_budget: Number,
    crew_wages: Number,
    other_expenses: Number
  },
  
  // یادداشت‌ها
  notes: { type: String, default: null },
  
  // متادیتا
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  last_updated_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { timestamps: true });

// ایندکس‌های مهم برای performance و business logic
boatSchema.index({ boat_code: 1, fishing_method_id: 1 }, { unique: true }); // کلید اصلی
boatSchema.index({ owner_id: 1 });
boatSchema.index({ boat_type_id: 1 });
boatSchema.index({ fishing_method_id: 1 });
boatSchema.index({ status: 1 });
boatSchema.index({ captain_id: 1 });

// Middleware برای validation
boatSchema.pre('save', function(next) {
  // اطمینان از اینکه یک شناور برای هر روش صید فقط یکبار ثبت شود
  if (this.isNew || this.isModified('boat_code') || this.isModified('fishing_method_id')) {
    mongoose.model('Boat').findOne({
      boat_code: this.boat_code,
      fishing_method_id: this.fishing_method_id,
      _id: { $ne: this._id }
    }).then(existingBoat => {
      if (existingBoat) {
        const error = new Error(`شناور با کد ${this.boat_code} قبلاً برای این روش صید ثبت شده است`);
        error.code = 'DUPLICATE_BOAT_METHOD';
        return next(error);
      }
      next();
    }).catch(next);
  } else {
    next();
  }
});

const Boat = mongoose.model("Boat", boatSchema);
export default Boat;
