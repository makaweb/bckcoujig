import mongoose from "mongoose";

const fishingActivitySchema = new mongoose.Schema({
  boat_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Boat", 
    required: true 
  },
  fishing_method_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "FishingMethod", 
    default: null
  },
  
  // تاریخ‌ها و زمان‌بندی
  start_date: { type: String, required: true }, // تاریخ شروع فعالیت
  end_date: { type: String, default: null }, // تاریخ پایان (اختیاری)
  
  // منطقه صید
  fishing_area: { type: String, default: null },
  
  // خدمه - ذخیره به صورت JSON string
  crew_details: { type: String, default: null }, // JSON stringified array
  
  // ابزارهای مورد استفاده - ذخیره به صورت JSON string
  tool_details: { type: String, default: null }, // JSON stringified array
  
  // نتایج صید - ذخیره به صورت JSON string
  catch_results: { type: String, default: null }, // JSON stringified array
  
  // هزینه‌ها - ذخیره به صورت JSON string
  expenses: { type: String, default: null }, // JSON stringified object
  
  // درآمد مالک
  owner_income: { type: Number, default: 0 },
  
  // یادداشت‌ها و گزارش
  notes: { type: String, default: null },
  
  // متادیتا
  created_by: { 
    type: String, // National code
    required: true 
  },
  last_updated_by: { 
    type: String // National code
  },
  
  // وضعیت
  status: {
    type: String,
    enum: ["planned", "in_progress", "completed", "cancelled"],
    default: "planned"
  },
  
  synced: { type: Number, default: 0 }
}, { timestamps: true });

// ایندکس‌ها
fishingActivitySchema.index({ boat_id: 1, start_date: -1 });
fishingActivitySchema.index({ fishing_method_id: 1 });
fishingActivitySchema.index({ status: 1 });
fishingActivitySchema.index({ created_by: 1 });

const FishingActivity = mongoose.model("FishingActivity", fishingActivitySchema);
export default FishingActivity;
