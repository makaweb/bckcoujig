import mongoose from "mongoose";

const fishingToolSchema = new mongoose.Schema({
  // نام فارسی (مطابق با name_fa در دیتابیس محلی)
  name: {
    type: String,
    required: true
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
  // دسته‌بندی ابزار
  category: {
    type: String,
    enum: ["net", "hook", "trap", "electronic", "mechanical", "other"],
    default: "other",
    required: false
  },
  // روش‌های صید سازگار (اختیاری)
  compatible_methods: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "FishingMethod"
  }],
  // مشخصات فنی (اختیاری)
  specifications: {
    size: String,
    material: String,
    weight: String,
    capacity: String,
    other: String
  },
  // نیاز به نگهداری (اختیاری)
  maintenance_required: {
    type: Boolean,
    default: false
  },
  // فاصله زمانی نگهداری به روز (اختیاری)
  maintenance_interval_days: {
    type: Number,
    default: null
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
  // ابزار والد (مطابق با parent_tool_id در دیتابیس محلی)
  parent_tool_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FishingTool",
    default: null
  },
  // روش صید مرتبط (مطابق با method_id در دیتابیس محلی)
  method_id: {
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
    default: "approved"
  }
}, { timestamps: true });

// ایندکس‌ها
fishingToolSchema.index({ name: 1 });
fishingToolSchema.index({ name_en: 1 });
fishingToolSchema.index({ category: 1 });
fishingToolSchema.index({ creator_id: 1 });
fishingToolSchema.index({ is_active: 1 });
fishingToolSchema.index({ is_default: 1 });
fishingToolSchema.index({ parent_tool_id: 1 });
fishingToolSchema.index({ method_id: 1 });
fishingToolSchema.index({ compatible_methods: 1 });

const FishingTool = mongoose.model("FishingTool", fishingToolSchema);
export default FishingTool;
