import mongoose from "mongoose";

const fishingMethodSchema = new mongoose.Schema({
  // نام فارسی (مطابق با name_fa در دیتابیس محلی)
  name: {
    type: String,
    required: true,
    // حذف enum برای انعطاف‌پذیری بیشتر
  },
  // نام انگلیسی (مطابق با name_en در دیتابیس محلی)
  name_en: {
    type: String,
    default: null
  },
  // توضیحات
  description: {
    type: String,
    default: null
  },
  // آیا نیاز به ابزار کمکی دارد؟ (مطابق با requires_fishing_tools در دیتابیس محلی)
  requires_tools: {
    type: Boolean,
    default: true
  },
  // حداقل تعداد خدمه
  min_crew_size: {
    type: Number,
    default: 1
  },
  // حداکثر تعداد خدمه
  max_crew_size: {
    type: Number,
    default: null
  },
  // محدودیت‌های فصلی (اختیاری)
  seasonal_restrictions: [{
    start_month: Number, // 1-12
    end_month: Number,   // 1-12
    description: String
  }],
  // آیا پیش‌فرض است؟ (مطابق با is_default در دیتابیس محلی)
  is_default: {
    type: Boolean,
    default: true
  },
  // کاربر ایجاد کننده (مطابق با creator_id در دیتابیس محلی)
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  // روش صید والد (مطابق با parent_method_id در دیتابیس محلی)
  parent_method_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FishingMethod",
    default: null
  },
  // وضعیت فعال بودن
  is_active: {
    type: Boolean,
    default: true
  },
  // وضعیت تأیید (مطابق با approval_status در دیتابیس محلی)
  approval_status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved" // برای روش‌های پیش‌فرض
  }
}, { timestamps: true });

// ایندکس برای جستجوی سریع
fishingMethodSchema.index({ name: 1 });
fishingMethodSchema.index({ name_en: 1 });
fishingMethodSchema.index({ creator_id: 1 });
fishingMethodSchema.index({ is_active: 1 });
fishingMethodSchema.index({ is_default: 1 });
fishingMethodSchema.index({ parent_method_id: 1 });

const FishingMethod = mongoose.model("FishingMethod", fishingMethodSchema);
export default FishingMethod;
