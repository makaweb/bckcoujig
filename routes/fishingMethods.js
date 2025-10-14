import express from 'express';
import mongoose from 'mongoose';
import FishingMethod from '../models/FishingMethod.js';

const router = express.Router();

// Helper function: تبدیل string به ObjectId (اگر معتبر باشد)
const toObjectId = (value) => {
  if (!value) return null;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null; // اگر معتبر نبود، null برمی‌گردانیم
};

// 🎣 **مدیریت روش‌های صید**

// 1. دریافت تمام روش‌های صید
router.get('/', async (req, res) => {
  try {
    const methods = await FishingMethod.find({ is_active: true })
      .populate('creator_id', 'name phone')
      .populate('parent_method_id', 'name name_en')
      .sort({ is_default: -1, name: 1 });

    res.json({
      success: true,
      methods,
      total: methods.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. دریافت یک روش صید بر اساس ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const method = await FishingMethod.findById(id)
      .populate('creator_id', 'name phone')
      .populate('parent_method_id', 'name name_en');

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'روش صید یافت نشد'
      });
    }

    res.json({
      success: true,
      method
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. ثبت روش صید جدید
router.post('/', async (req, res) => {
  try {
    const {
      name,
      name_en,
      description,
      requires_tools,
      min_crew_size,
      max_crew_size,
      is_default,
      creator_id,
      parent_method_id,
      is_active,
      approval_status
    } = req.body;

    // بررسی تکراری بودن نام
    const existingMethod = await FishingMethod.findOne({ name });

    if (existingMethod) {
      return res.status(400).json({
        success: false,
        error: `روش صید با نام "${name}" قبلاً ثبت شده است`,
        code: 'DUPLICATE_METHOD'
      });
    }

    const newMethod = new FishingMethod({
      name,
      name_en,
      description,
      requires_tools,
      min_crew_size,
      max_crew_size,
      is_default,
      creator_id,
      parent_method_id,
      is_active,
      approval_status
    });

    await newMethod.save();

    res.status(201).json({
      success: true,
      message: 'روش صید با موفقیت ثبت شد',
      method: newMethod
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. بروزرسانی روش صید
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const method = await FishingMethod.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'روش صید یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'روش صید با موفقیت بروزرسانی شد',
      method
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. حذف روش صید (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const method = await FishingMethod.findByIdAndUpdate(
      id,
      { $set: { is_active: false } },
      { new: true }
    );

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'روش صید یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'روش صید با موفقیت حذف شد',
      method
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. همگام‌سازی روش‌های صید (Sync)
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 شروع همگام‌سازی روش‌های صید...');
    console.log('📦 داده‌های دریافتی:', JSON.stringify(req.body, null, 2));

    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // 1. پردازش روش‌های صید جدید (Created)
    if (created && Array.isArray(created)) {
      console.log(`📊 تعداد روش‌های صید جدید: ${created.length}`);
      
      for (const methodData of created) {
        const { id: localId, ...newMethodData } = methodData;
        try {
          console.log(`📝 پردازش روش صید جدید: ${newMethodData.name} (Local ID: ${localId})`);

          // تبدیل string IDs به ObjectId
          const cleanedData = {
            ...newMethodData,
            creator_id: toObjectId(newMethodData.creator_id),
            parent_method_id: toObjectId(newMethodData.parent_method_id),
          };

          // بررسی وجود روش صید با همین نام
          let method = await FishingMethod.findOne({
            name: cleanedData.name,
          });

          if (method) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم (merge)
            console.log(`🔄 روش صید موجود است، بروزرسانی می‌شود...`);
            Object.assign(method, cleanedData);
            await method.save();
            results.updated.push({ localId, serverId: method._id.toString(), status: 'merged' });
            console.log(`✅ روش صید با موفقیت merge شد. Server ID: ${method._id}`);
          } else {
            // اگر وجود نداشت، روش صید جدید را می‌سازیم
            console.log(`➕ ایجاد روش صید جدید...`);
            method = new FishingMethod(cleanedData);
            await method.save();
            results.created.push({ localId, serverId: method._id.toString() });
            console.log(`✅ روش صید با موفقیت ایجاد شد. Server ID: ${method._id}`);
          }
        } catch (error) {
          console.error(`❌ خطا در پردازش روش صید (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // 2. پردازش روش‌های صید آپدیت شده (Updated)
    if (updated && Array.isArray(updated)) {
      console.log(`📊 تعداد روش‌های صید برای بروزرسانی: ${updated.length}`);
      
      for (const methodData of updated) {
        const { id: localId, server_id, ...updateData } = methodData;
        try {
          console.log(`🔄 بروزرسانی روش صید: ${updateData.name} (Local ID: ${localId})`);

          // تبدیل string IDs به ObjectId
          const cleanedData = {
            ...updateData,
            creator_id: toObjectId(updateData.creator_id),
            parent_method_id: toObjectId(updateData.parent_method_id),
          };

          let method;
          if (server_id) {
            method = await FishingMethod.findByIdAndUpdate(
              server_id,
              { $set: cleanedData },
              { new: true, runValidators: true }
            );
          } else {
            // جستجو بر اساس نام
            method = await FishingMethod.findOneAndUpdate(
              { name: cleanedData.name },
              { $set: cleanedData },
              { new: true, runValidators: true }
            );
          }

          if (method) {
            results.updated.push({ localId, serverId: method._id.toString(), status: 'updated' });
            console.log(`✅ روش صید با موفقیت بروزرسانی شد`);
          } else {
            console.log(`⚠️ روش صید برای آپدیت یافت نشد`);
            results.errors.push({ localId, error: 'روش صید برای آپدیت یافت نشد' });
          }
        } catch (error) {
          console.error(`❌ خطا در بروزرسانی روش صید (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // 3. ارسال داده‌های جدید سرور به کلاینت
    const { last_sync_timestamp } = req.query;
    let serverUpdates = [];
    if (last_sync_timestamp) {
      serverUpdates = await FishingMethod.find({ 
        updatedAt: { $gt: new Date(last_sync_timestamp) } 
      })
      .populate('creator_id', 'name phone')
      .populate('parent_method_id', 'name name_en');
    }

    console.log('✅ همگام‌سازی روش‌های صید با موفقیت انجام شد');
    console.log(`📊 نتایج: ${results.created.length} ایجاد، ${results.updated.length} بروزرسانی، ${results.errors.length} خطا`);

    res.json({
      success: true,
      message: 'همگام‌سازی با موفقیت انجام شد',
      results,
      server_updates: serverUpdates
    });

  } catch (error) {
    console.error('❌ خطا در همگام‌سازی روش‌های صید:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;