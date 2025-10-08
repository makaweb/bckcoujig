import express from 'express';
import FishingTool from '../models/FishingTool.js';

const router = express.Router();

// 🔧 **مدیریت ابزارهای صید**

// 1. دریافت تمام ابزارهای صید
router.get('/', async (req, res) => {
  try {
    const tools = await FishingTool.find({ is_active: true })
      .populate('creator_id', 'name phone')
      .populate('parent_tool_id', 'name name_en')
      .populate('method_id', 'name name_en')
      .populate('compatible_methods', 'name name_en')
      .sort({ is_default: -1, name: 1 });

    res.json({
      success: true,
      tools,
      total: tools.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. دریافت یک ابزار صید بر اساس ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tool = await FishingTool.findById(id)
      .populate('creator_id', 'name phone')
      .populate('parent_tool_id', 'name name_en')
      .populate('method_id', 'name name_en')
      .populate('compatible_methods', 'name name_en');

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'ابزار صید یافت نشد'
      });
    }

    res.json({
      success: true,
      tool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. ثبت ابزار صید جدید
router.post('/', async (req, res) => {
  try {
    const {
      name,
      name_en,
      description,
      category,
      compatible_methods,
      specifications,
      maintenance_required,
      maintenance_interval_days,
      is_default,
      creator_id,
      parent_tool_id,
      method_id,
      is_active,
      approval_status
    } = req.body;

    // بررسی تکراری بودن نام
    const existingTool = await FishingTool.findOne({ name });

    if (existingTool) {
      return res.status(400).json({
        success: false,
        error: `ابزار صید با نام "${name}" قبلاً ثبت شده است`,
        code: 'DUPLICATE_TOOL'
      });
    }

    const newTool = new FishingTool({
      name,
      name_en,
      description,
      category,
      compatible_methods,
      specifications,
      maintenance_required,
      maintenance_interval_days,
      is_default,
      creator_id,
      parent_tool_id,
      method_id,
      is_active,
      approval_status
    });

    await newTool.save();

    res.status(201).json({
      success: true,
      message: 'ابزار صید با موفقیت ثبت شد',
      tool: newTool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. بروزرسانی ابزار صید
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const tool = await FishingTool.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'ابزار صید یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'ابزار صید با موفقیت بروزرسانی شد',
      tool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. حذف ابزار صید (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await FishingTool.findByIdAndUpdate(
      id,
      { $set: { is_active: false } },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'ابزار صید یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'ابزار صید با موفقیت حذف شد',
      tool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. همگام‌سازی ابزارهای صید (Sync)
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 شروع همگام‌سازی ابزارهای صید...');
    console.log('📦 داده‌های دریافتی:', JSON.stringify(req.body, null, 2));

    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // 1. پردازش ابزارهای صید جدید (Created)
    if (created && Array.isArray(created)) {
      console.log(`📊 تعداد ابزارهای صید جدید: ${created.length}`);
      
      for (const toolData of created) {
        const { id: localId, ...newToolData } = toolData;
        try {
          console.log(`📝 پردازش ابزار صید جدید: ${newToolData.name} (Local ID: ${localId})`);

          // بررسی وجود ابزار صید با همین نام
          let tool = await FishingTool.findOne({
            name: newToolData.name,
          });

          if (tool) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم (merge)
            console.log(`🔄 ابزار صید موجود است، بروزرسانی می‌شود...`);
            Object.assign(tool, newToolData);
            await tool.save();
            results.updated.push({ localId, serverId: tool._id.toString(), status: 'merged' });
            console.log(`✅ ابزار صید با موفقیت merge شد. Server ID: ${tool._id}`);
          } else {
            // اگر وجود نداشت، ابزار صید جدید را می‌سازیم
            console.log(`➕ ایجاد ابزار صید جدید...`);
            tool = new FishingTool(newToolData);
            await tool.save();
            results.created.push({ localId, serverId: tool._id.toString() });
            console.log(`✅ ابزار صید با موفقیت ایجاد شد. Server ID: ${tool._id}`);
          }
        } catch (error) {
          console.error(`❌ خطا در پردازش ابزار صید (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // 2. پردازش ابزارهای صید آپدیت شده (Updated)
    if (updated && Array.isArray(updated)) {
      console.log(`📊 تعداد ابزارهای صید برای بروزرسانی: ${updated.length}`);
      
      for (const toolData of updated) {
        const { id: localId, server_id, ...updateData } = toolData;
        try {
          console.log(`🔄 بروزرسانی ابزار صید: ${updateData.name} (Local ID: ${localId})`);

          let tool;
          if (server_id) {
            tool = await FishingTool.findByIdAndUpdate(
              server_id,
              { $set: updateData },
              { new: true, runValidators: true }
            );
          } else {
            // جستجو بر اساس نام
            tool = await FishingTool.findOneAndUpdate(
              { name: updateData.name },
              { $set: updateData },
              { new: true, runValidators: true }
            );
          }

          if (tool) {
            results.updated.push({ localId, serverId: tool._id.toString(), status: 'updated' });
            console.log(`✅ ابزار صید با موفقیت بروزرسانی شد`);
          } else {
            console.log(`⚠️ ابزار صید برای آپدیت یافت نشد`);
            results.errors.push({ localId, error: 'ابزار صید برای آپدیت یافت نشد' });
          }
        } catch (error) {
          console.error(`❌ خطا در بروزرسانی ابزار صید (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // 3. ارسال داده‌های جدید سرور به کلاینت
    const { last_sync_timestamp } = req.query;
    let serverUpdates = [];
    if (last_sync_timestamp) {
      serverUpdates = await FishingTool.find({ 
        updatedAt: { $gt: new Date(last_sync_timestamp) } 
      })
      .populate('creator_id', 'name phone')
      .populate('parent_tool_id', 'name name_en')
      .populate('method_id', 'name name_en')
      .populate('compatible_methods', 'name name_en');
    }

    console.log('✅ همگام‌سازی ابزارهای صید با موفقیت انجام شد');
    console.log(`📊 نتایج: ${results.created.length} ایجاد، ${results.updated.length} بروزرسانی، ${results.errors.length} خطا`);

    res.json({
      success: true,
      message: 'همگام‌سازی با موفقیت انجام شد',
      results,
      server_updates: serverUpdates
    });

  } catch (error) {
    console.error('❌ خطا در همگام‌سازی ابزارهای صید:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
