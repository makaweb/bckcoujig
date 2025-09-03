import mongoose from "mongoose";

const fishingMethodSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    enum: ["چیرآپ", "سرآپ", "قلاب", "برام", "لانگ لاین", "محاصره", "ماهی مرکب", "پنجرو", "دیگر"]
  },
  name_en: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  requires_tools: { 
    type: Boolean, 
    default: false 
  }, // آیا نیاز به ابزار کمکی دارد؟
  min_crew_size: { 
    type: Number, 
    default: 1 
  },
  max_crew_size: { 
    type: Number, 
    default: null 
  },
  seasonal_restrictions: [{
    start_month: Number, // 1-12
    end_month: Number,   // 1-12
    description: String
  }],
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
    default: "approved" // برای روش‌های پیش‌فرض
  }
}, { timestamps: true });

// ایندکس برای جستجوی سریع
fishingMethodSchema.index({ name: 1 });
fishingMethodSchema.index({ custom_added_by: 1 });
fishingMethodSchema.index({ is_active: 1 });

const FishingMethod = mongoose.model("FishingMethod", fishingMethodSchema);
export default FishingMethod;
