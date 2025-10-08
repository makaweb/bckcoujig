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
  // وضعیت فعال بودن
  is_active: {
    type: Boolean,
    default: true
  },
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
