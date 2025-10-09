// backend/routes/boatTypes.js

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// تعریف Schema برای BoatType
const boatTypeSchema = new mongoose.Schema({
  name_fa: { type: String, required: true },
  name_en: { type: String, required: true },
  description: { type: String },
  is_default: { type: Boolean, default: true },
  creator_id: { type: String, default: 'system' },
  synced: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// بررسی اینکه آیا مدل قبلاً تعریف شده یا نه
const BoatType = mongoose.models.BoatType || mongoose.model('BoatType', boatTypeSchema);

// انواع شناور پیش‌فرض
const defaultBoatTypes = [
  {
    name_fa: 'فایبرگلاس',
    name_en: 'Fiberglass',
    description: 'شناور ساخته شده از فایبرگلاس',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار چوبی',
    name_en: 'Wooden Yekdar',
    description: 'شناور سنتی چوبی یکدار',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'لنج',
    name_en: 'Lenj',
    description: 'شناور سنتی لنج',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'لنج یخچالدار',
    name_en: 'Ice Lenj',
    description: 'لنج مجهز به یخچال',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار فایبرگلاس',
    name_en: 'Fiberglass Yekdar',
    description: 'یکدار ساخته شده از فایبرگلاس',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار یخچالدار',
    name_en: 'Ice Yekdar',
    description: 'یکدار مجهز به یخچال',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
];

/**
 * GET /boats/boat-types
 * دریافت تمام انواع شناور
 */
router.get('/', async (req, res) => {
  try {
    console.log('📥 [GET] /boats/boat-types - Fetching boat types');

    const boatTypes = await BoatType.find().sort({ name_fa: 1 });

    // اگر هیچ نوع شناوری وجود نداشت، انواع پیش‌فرض را ذخیره کن
    if (boatTypes.length === 0) {
      console.log('⚠️  No boat types found. Initializing defaults...');
      const inserted = await BoatType.insertMany(defaultBoatTypes);
      console.log(`✅ Inserted ${inserted.length} default boat types`);
      
      return res.json({
        success: true,
        message: 'انواع شناور پیش‌فرض ایجاد شد',
        data: inserted,
        count: inserted.length,
      });
    }

    console.log(`✅ Found ${boatTypes.length} boat types`);
    res.json({
      success: true,
      data: boatTypes,
      count: boatTypes.length,
    });
  } catch (error) {
    console.error('❌ Error fetching boat types:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت انواع شناور',
      details: error.message,
    });
  }
});

/**
 * POST /boats/boat-types/upload-defaults
 * آپلود انواع شناور پیش‌فرض (برای اولین بار)
 */
router.post('/upload-defaults', async (req, res) => {
  try {
    console.log('📤 [POST] /boats/boat-types/upload-defaults');
    const { boatTypes } = req.body;

    if (!boatTypes || !Array.isArray(boatTypes)) {
      return res.status(400).json({
        success: false,
        error: 'لیست انواع شناور ارسال نشده است',
      });
    }

    // بررسی وجود انواع شناور
    const existingCount = await BoatType.countDocuments();
    
    if (existingCount > 0) {
      console.log(`⚠️  ${existingCount} boat types already exist`);
      return res.json({
        success: true,
        message: `${existingCount} نوع شناور از قبل در دیتابیس وجود دارد`,
        count: existingCount,
        skipped: true,
      });
    }

    // ذخیره انواع شناور جدید
    const result = await BoatType.insertMany(boatTypes);
    console.log(`✅ Inserted ${result.length} boat types`);

    res.json({
      success: true,
      message: `${result.length} نوع شناور با موفقیت ذخیره شد`,
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error('❌ Error uploading boat types:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ذخیره انواع شناور',
      details: error.message,
    });
  }
});

/**
 * POST /boats/boat-types/sync
 * همگام‌سازی انواع شناور
 */
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 [POST] /boats/boat-types/sync');
    const { created, updated } = req.body;

    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // ایجاد انواع جدید
    if (created && Array.isArray(created)) {
      for (const type of created) {
        try {
          const newType = new BoatType(type);
          const saved = await newType.save();
          results.created.push(saved);
        } catch (error) {
          results.errors.push({
            type: type.name_fa,
            error: error.message,
          });
        }
      }
    }

    // بروزرسانی انواع موجود
    if (updated && Array.isArray(updated)) {
      for (const type of updated) {
        try {
          const updatedType = await BoatType.findByIdAndUpdate(
            type._id,
            { ...type, updated_at: new Date() },
            { new: true }
          );
          if (updatedType) {
            results.updated.push(updatedType);
          }
        } catch (error) {
          results.errors.push({
            type: type.name_fa,
            error: error.message,
          });
        }
      }
    }

    console.log(`✅ Sync completed: ${results.created.length} created, ${results.updated.length} updated`);

    res.json({
      success: true,
      message: 'همگام‌سازی با موفقیت انجام شد',
      results,
    });
  } catch (error) {
    console.error('❌ Error syncing boat types:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در همگام‌سازی انواع شناور',
      details: error.message,
    });
  }
});

/**
 * POST /boats/boat-types/ensure-defaults
 * اطمینان از وجود انواع پیش‌فرض (برای استفاده خودکار)
 */
router.post('/ensure-defaults', async (req, res) => {
  try {
    console.log('🔍 [POST] /boats/boat-types/ensure-defaults');

    const existingCount = await BoatType.countDocuments();

    if (existingCount > 0) {
      console.log(`✅ ${existingCount} boat types already exist`);
      return res.json({
        success: true,
        message: 'انواع شناور از قبل وجود دارد',
        count: existingCount,
        initialized: false,
      });
    }

    // ذخیره انواع پیش‌فرض
    const result = await BoatType.insertMany(defaultBoatTypes);
    console.log(`✅ Initialized ${result.length} default boat types`);

    res.json({
      success: true,
      message: `${result.length} نوع شناور پیش‌فرض ایجاد شد`,
      data: result,
      count: result.length,
      initialized: true,
    });
  } catch (error) {
    console.error('❌ Error ensuring defaults:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ایجاد انواع پیش‌فرض',
      details: error.message,
    });
  }
});

export default router;
