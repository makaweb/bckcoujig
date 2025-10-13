import mongoose from "mongoose";
import moment from "moment-jalaali";

const fishingActivitySchema = new mongoose.Schema({
  boat_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Boat", 
    required: true 
  },
  fishing_method_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "FishingMethod", 
    required: true 
  },
  
  // تاریخ‌ها و زمان‌بندی
  start_date: { type: String, required: true }, // تاریخ شروع فعالیت
  end_date: { type: String, default: null }, // تاریخ پایان (اختیاری)
  estimated_duration_days: { type: Number, default: null },
  
  // منطقه صید
  fishing_area: {
    name: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    depth_range: {
      min: Number,
      max: Number
    }
  },
  
  // خدمه
  crew_members: [{
    user_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    role: {
      type: String,
      enum: ["captain", "first_mate", "fisherman", "engineer", "cook", "other"]
    },
    join_date: String,
    leave_date: String,
    daily_wage: Number
  }],
  
  // ابزارهای مورد استفاده
  tools_used: [{
    tool_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "FishingTool" 
    },
    quantity: Number,
    condition_before: String,
    condition_after: String,
    maintenance_needed: Boolean
  }],
  
  // نتایج صید
  catch_results: [{
    fish_type: String,
    quantity: Number,
    unit: { type: String, enum: ["kg", "piece", "box"], default: "kg" },
    quality_grade: { type: String, enum: ["A", "B", "C"], default: "A" },
    market_price: Number
  }],
  
  // هزینه‌ها
  expenses: {
    fuel_cost: Number,
    crew_wages: Number,
    tool_maintenance: Number,
    food_supplies: Number,
    other_costs: Number,
    total_cost: Number
  },
  
  // درآمد
  revenue: {
    total_sale: Number,
    sale_date: String,
    buyer_info: String,
    profit_margin: Number
  },
  
  // وضعیت
  status: {
    type: String,
    enum: ["planned", "in_progress", "completed", "cancelled"],
    default: "planned"
  },
  
  // یادداشت‌ها و گزارش
  notes: String,
  weather_conditions: String,
  challenges_faced: [String],
  lessons_learned: String,
  
  // متادیتا
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  last_updated_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  
  // فیلدهای اضافی برای سازگاری با نسخه ملوان
  crew: [{
    nationalCode: String,
    name: String,
    role: String,
    share: Number,
    income: Number
  }],
  total_income: { type: Number, default: 0 },
  total_expense: { type: Number, default: 0 },
  settlement_status: { 
    type: String, 
    enum: ['pending', 'partial', 'completed'], 
    default: 'pending' 
  },
  
  // اعتراضات ملوانان
  disputes: [{
    sailorNationalCode: String,
    reason: String,
    description: String,
    status: { 
      type: String, 
      enum: ['pending', 'reviewing', 'resolved', 'rejected'], 
      default: 'pending' 
    },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    resolution: String
  }]
}, { timestamps: true });

// ایندکس‌ها
fishingActivitySchema.index({ boat_id: 1, start_date: -1 });
fishingActivitySchema.index({ fishing_method_id: 1 });
fishingActivitySchema.index({ status: 1 });
fishingActivitySchema.index({ "crew_members.user_id": 1 });
fishingActivitySchema.index({ "crew.nationalCode": 1 }); // برای نسخه ملوان

const FishingActivity = mongoose.model("FishingActivity", fishingActivitySchema);
export default FishingActivity;
