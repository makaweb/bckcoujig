import mongoose from "mongoose";

const boatTypeSchema = new mongoose.Schema({
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
  // محدوده طول معمول (اختیاری)
  typical_length_range: {
    min: Number, // متر
    max: Number
  },
  // ظرفیت خدمه معمول (اختیاری)
  typical_crew_capacity: {
    min: Number,
    max: Number
  },
  // کارایی سوخت (اختیاری)
  fuel_efficiency: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  // روش‌های صید مناسب (اختیاری)
  suitable_methods: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "FishingMethod"
  }],
  // نیازهای نگهداری (اختیاری)
  maintenance_requirements: {
    frequency: String,
    estimated_cost: String,
    special_needs: [String]
  },
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
  // وضعیت فعال بودن
  is_active: {
    type: Boolean,
    default: true
  },
  // وضعیت تأیید (مطابق با approval_status در دیتابیس محلی)
  approval_status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved"
  }
}, { timestamps: true });

// ایندکس برای جستجوی سریع
boatTypeSchema.index({ name: 1 });
boatTypeSchema.index({ name_en: 1 });
boatTypeSchema.index({ creator_id: 1 });
boatTypeSchema.index({ is_active: 1 });
boatTypeSchema.index({ is_default: 1 });

const BoatType = mongoose.model("BoatType", boatTypeSchema);
export default BoatType;
