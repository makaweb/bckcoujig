import express from 'express';
import Boat from '../models/Boat.js';
import FishingMethod from '../models/FishingMethod.js';
import BoatType from '../models/BoatType.js';
import FishingTool from '../models/FishingTool.js';
import FishingActivity from '../models/FishingActivity.js';

const router = express.Router();

// 🚤 **مدیریت شناورها**

// 1. دریافت تمام شناورهای مالک
router.get('/boats/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const boats = await Boat.find({ owner_id: ownerId })
      .populate('boat_type_id')
      .populate('fishing_method_id')
      .populate('captain_id', 'name phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      boats,
      total: boats.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. ثبت شناور جدید
router.post('/boats', async (req, res) => {
  try {
    const {
      boat_name,
      boat_code,
      boat_type_id,
      fishing_method_id,
      owner_id,
      ...otherData
    } = req.body;

    // بررسی تکراری بودن شناور برای روش صید مشخص
    const existingBoat = await Boat.findOne({
      boat_code,
      fishing_method_id
    });

    if (existingBoat) {
      return res.status(400).json({
        success: false,
        error: `شناور با کد ${boat_code} قبلاً برای این روش صید ثبت شده است`,
        code: 'DUPLICATE_BOAT_METHOD'
      });
    }

    const newBoat = new Boat({
      boat_name,
      boat_code,
      boat_type_id,
      fishing_method_id,
      owner_id,
      created_by: owner_id,
      ...otherData
    });

    await newBoat.save();
    
    // بارگذاری اطلاعات کامل
    const populatedBoat = await Boat.findById(newBoat._id)
      .populate('boat_type_id')
      .populate('fishing_method_id')
      .populate('captain_id', 'name phone');

    res.status(201).json({
      success: true,
      message: 'شناور با موفقیت ثبت شد',
      boat: populatedBoat
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_BOAT_METHOD') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. بررسی امکان ثبت شناور (قبل از ثبت)
router.post('/boats/check-availability', async (req, res) => {
  try {
    const { boat_code, fishing_method_id } = req.body;

    const existingBoat = await Boat.findOne({
      boat_code,
      fishing_method_id
    }).populate('fishing_method_id', 'name');

    if (existingBoat) {
      return res.json({
        success: false,
        available: false,
        message: `شناور با کد ${boat_code} قبلاً برای روش صید "${existingBoat.fishing_method_id.name}" ثبت شده است`,
        existing_boat: {
          id: existingBoat._id,
          name: existingBoat.boat_name,
          method: existingBoat.fishing_method_id.name
        }
      });
    }

    res.json({
      success: true,
      available: true,
      message: 'شناور قابل ثبت است'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.5. بررسی شناور موجود و پیشنهاد گزینه‌ها
router.post('/boats/check-existing', async (req, res) => {
  try {
    const { boat_code, fishing_method_id, owner_id } = req.body;

    // جستجوی تمام شناورهای با این کد
    const allBoatsWithCode = await Boat.find({ boat_code })
      .populate('boat_type_id', 'name restrictions')
      .populate('fishing_method_id', 'name')
      .populate('owner_id', 'name phone')
      .populate('captain_id', 'name phone')
      .sort({ createdAt: -1 });

    if (allBoatsWithCode.length === 0) {
      // شناور جدید - هیچ کدی وجود ندارد
      return res.json({
        success: true,
        scenario: 'new_boat',
        message: 'شناور جدید - کد قبلاً ثبت نشده',
        suggestions: {
          action: 'register_new',
          can_proceed: true
        }
      });
    }

    // بررسی اینکه آیا برای این روش صید و این مالک قبلاً ثبت شده یا نه
    const exactMatch = allBoatsWithCode.find(boat => 
      boat.fishing_method_id._id.toString() === fishing_method_id &&
      boat.owner_id._id.toString() === owner_id
    );

    if (exactMatch) {
      // شناور برای همین روش صید موجود است
      return res.json({
        success: false,
        scenario: 'duplicate_method',
        message: `شناور "${exactMatch.boat_name}" قبلاً برای روش صید "${exactMatch.fishing_method_id.name}" ثبت شده است`,
        existing_boat: {
          id: exactMatch._id,
          name: exactMatch.boat_name,
          method: exactMatch.fishing_method_id.name,
          owner: exactMatch.owner_id.name,
          captain: exactMatch.captain_id?.name
        },
        can_proceed: false
      });
    }

    // شناور موجود اما برای روش صید متفاوت
    const baseBoat = allBoatsWithCode[0]; // آخرین ثبت شده
    const currentMethodName = await FishingMethod.findById(fishing_method_id).select('name');

    // بررسی محدودیت‌های نوع شناور
    const boatType = baseBoat.boat_type_id;
    let canAddMethod = true;
    let restrictionMessage = '';

    if (boatType.restrictions && boatType.restrictions.single_method_only) {
      canAddMethod = false;
      restrictionMessage = `شناورهای نوع "${boatType.name}" فقط مجاز به یک روش صید هستند`;
    }

    // تولید نام پیشنهادی برای شناور جدید
    const suggestedName = `${baseBoat.boat_name.split(' - ')[0]} - ${currentMethodName.name}`;

    return res.json({
      success: true,
      scenario: 'existing_boat_new_method',
      message: `شناور با کد ${boat_code} موجود است`,
      existing_boats: allBoatsWithCode.map(boat => ({
        id: boat._id,
        name: boat.boat_name,
        method: boat.fishing_method_id.name,
        owner: boat.owner_id.name,
        captain: boat.captain_id?.name,
        created_at: boat.createdAt
      })),
      suggestions: {
        action: canAddMethod ? 'add_method_or_new_boat' : 'register_new_only',
        can_add_method: canAddMethod,
        restriction_message: restrictionMessage,
        suggested_boat_name: suggestedName,
        base_boat_info: {
          id: baseBoat._id,
          name: baseBoat.boat_name,
          owner_id: baseBoat.owner_id._id,
          boat_type_id: baseBoat.boat_type_id._id,
          boat_type_name: baseBoat.boat_type_id.name,
          specifications: {
            length: baseBoat.length,
            width: baseBoat.width,
            engine_power: baseBoat.engine_power,
            hull_material: baseBoat.hull_material,
            manufacturer_year: baseBoat.manufacturer_year
          }
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.6. افزودن روش صید جدید به شناور موجود
router.post('/boats/add-fishing-method', async (req, res) => {
  try {
    const {
      base_boat_id,
      fishing_method_id,
      boat_name, // نام جدید پیشنهادی
      captain_id,
      crew_data,
      owner_id
    } = req.body;

    // دریافت اطلاعات شناور مبنا
    const baseBoat = await Boat.findById(base_boat_id)
      .populate('boat_type_id');

    if (!baseBoat) {
      return res.status(404).json({
        success: false,
        error: 'شناور مبنا یافت نشد'
      });
    }

    // بررسی محدودیت‌های نوع شناور
    if (baseBoat.boat_type_id.restrictions?.single_method_only) {
      return res.status(400).json({
        success: false,
        error: `شناورهای نوع "${baseBoat.boat_type_id.name}" فقط مجاز به یک روش صید هستند`
      });
    }

    // بررسی عدم تکرار با در نظر گرفتن مالک
    const existing = await Boat.findOne({
      boat_code: baseBoat.boat_code,
      fishing_method_id,
      owner_id: owner_id || baseBoat.owner_id
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'این روش صید قبلاً برای این شناور و این مالک ثبت شده است'
      });
    }

    // ایجاد شناور جدید با روش صید متفاوت
    const newBoatEntry = new Boat({
      // کپی اطلاعات اصلی
      boat_name: boat_name || baseBoat.boat_name,
      boat_code: baseBoat.boat_code,
      boat_type_id: baseBoat.boat_type_id._id,
      owner_id: owner_id || baseBoat.owner_id,
      
      // اطلاعات جدید
      fishing_method_id,
      captain_id,
      
      // کپی مشخصات فنی
      length: baseBoat.length,
      width: baseBoat.width,
      engine_power: baseBoat.engine_power,
      fuel_capacity: baseBoat.fuel_capacity,
      hull_material: baseBoat.hull_material,
      manufacturer_year: baseBoat.manufacturer_year,
      
      // کپی ابزارهای نصب شده (اختیاری)
      installed_tools: baseBoat.installed_tools,
      
      // متادیتا
      created_by: owner_id || baseBoat.owner_id,
      notes: `افزوده شده بر اساس شناور ${baseBoat.boat_name}`
    });

    await newBoatEntry.save();

    // بارگذاری اطلاعات کامل
    const populatedBoat = await Boat.findById(newBoatEntry._id)
      .populate('boat_type_id')
      .populate('fishing_method_id')
      .populate('captain_id', 'name phone')
      .populate('owner_id', 'name phone');

    res.status(201).json({
      success: true,
      message: 'روش صید جدید با موفقیت برای شناور اضافه شد',
      boat: populatedBoat,
      base_boat_id: base_boat_id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.7. همگام‌سازی شناورها (Sync)
router.post('/boats/sync', async (req, res) => {
  try {
    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // 1. پردازش شناورهای جدید (Created)
    if (created && Array.isArray(created)) {
      for (const boatData of created) {
        const { id: localId, ...newBoatData } = boatData;
        try {
          console.log(`📝 پردازش شناور جدید: ${newBoatData.boat_name} (Local ID: ${localId})`);
          console.log(`   - boat_type_id: ${newBoatData.boat_type_id}`);
          console.log(`   - fishing_method_id: ${newBoatData.fishing_method_id}`);

          // چون ممکن است شناور در سرور وجود داشته باشد (مثلا توسط کاربر دیگری ثبت شده)
          // ابتدا بر اساس کلیدهای اصلی (boat_code, fishing_method_id) چک می‌کنیم
          let boat = await Boat.findOne({
            boat_code: newBoatData.boat_code,
            fishing_method_id: newBoatData.fishing_method_id,
          });

          if (boat) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم (last write wins)
            console.log(`🔄 شناور موجود است، بروزرسانی می‌شود...`);
            Object.assign(boat, newBoatData, { synced: 1 });
            await boat.save();
            results.updated.push({ localId, serverId: boat._id.toString(), status: 'merged' });
          } else {
            // اگر وجود نداشت، شناور جدید را می‌سازیم
            console.log(`➕ ایجاد شناور جدید...`);
            boat = new Boat({ ...newBoatData, synced: 1 });
            await boat.save();
            results.created.push({ localId, serverId: boat._id.toString() });
            console.log(`✅ شناور با موفقیت ایجاد شد. Server ID: ${boat._id}`);
          }
        } catch (error) {
          console.error(`❌ خطا در پردازش شناور (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // 2. پردازش شناورهای آپدیت شده (Updated)
    if (updated && Array.isArray(updated)) {
      for (const boatData of updated) {
        const { id: localId, ...updateData } = boatData;
        try {
          console.log(`🔄 بروزرسانی شناور: ${updateData.boat_name} (Local ID: ${localId})`);

          // اگر server_id وجود نداشت، از boat_code و fishing_method_id استفاده می‌کنیم
          let boat;
          if (updateData.server_id) {
            boat = await Boat.findByIdAndUpdate(
              updateData.server_id,
              { $set: { ...updateData, synced: 1 } },
              { new: true, runValidators: true }
            );
          } else {
            // جستجو بر اساس boat_code و fishing_method_id
            boat = await Boat.findOneAndUpdate(
              {
                boat_code: updateData.boat_code,
                fishing_method_id: updateData.fishing_method_id
              },
              { $set: { ...updateData, synced: 1 } },
              { new: true, runValidators: true }
            );
          }

          if (boat) {
            results.updated.push({ localId, serverId: boat._id.toString(), status: 'updated' });
            console.log(`✅ شناور با موفقیت بروزرسانی شد`);
          } else {
            console.log(`⚠️ شناور برای آپدیت یافت نشد`);
            results.errors.push({ localId, error: 'شناور برای آپدیت یافت نشد' });
          }
        } catch (error) {
          console.error(`❌ خطا در بروزرسانی شناور (Local ID: ${localId}): ${error.message}`);
          results.errors.push({ localId, error: error.message });
        }
      }
    }
    
    // 3. ارسال داده‌های جدید سرور به کلاینت
    // کلاینت می‌تواند آخرین زمان همگام‌سازی را بفرستد
    const { last_sync_timestamp } = req.query;
    let serverUpdates = [];
    if (last_sync_timestamp) {
        serverUpdates = await Boat.find({ updatedAt: { $gt: new Date(last_sync_timestamp) } })
                                  .populate('boat_type_id')
                                  .populate('fishing_method_id');
    }


    res.json({
      success: true,
      message: 'همگام‌سازی با موفقیت انجام شد',
      results,
      server_updates: serverUpdates
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: `خطا در پردازش همگام‌سازی: ${error.message}`
    });
  }
});

// 4. به‌روزرسانی شناور
router.put('/boats/:boatId', async (req, res) => {
  try {
    const { boatId } = req.params;
    const updateData = req.body;

    const boat = await Boat.findByIdAndUpdate(
      boatId,
      { ...updateData, last_updated_by: updateData.updated_by },
      { new: true, runValidators: true }
    ).populate('boat_type_id')
     .populate('fishing_method_id')
     .populate('captain_id', 'name phone');

    if (!boat) {
      return res.status(404).json({
        success: false,
        error: 'شناور یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'شناور با موفقیت به‌روزرسانی شد',
      boat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. حذف شناور
router.delete('/boats/:boatId', async (req, res) => {
  try {
    const { boatId } = req.params;

    // بررسی وجود فعالیت‌های مرتبط
    const hasActivities = await FishingActivity.findOne({ boat_id: boatId });
    
    if (hasActivities) {
      return res.status(400).json({
        success: false,
        error: 'امکان حذف شناور وجود ندارد. فعالیت‌های ثبت شده برای این شناور موجود است.'
      });
    }

    const boat = await Boat.findByIdAndDelete(boatId);

    if (!boat) {
      return res.status(404).json({
        success: false,
        error: 'شناور یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'شناور با موفقیت حذف شد'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🎣 **مدیریت روش‌های صید**

// 1. دریافت روش‌های صید فعال
router.get('/fishing-methods', async (req, res) => {
  try {
    const methods = await FishingMethod.find({ is_active: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      methods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 1.5. همگام‌سازی روش‌های صید
router.post('/fishing-methods/sync', async (req, res) => {
  try {
    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // پردازش روش‌های صید جدید
    if (created && Array.isArray(created)) {
      for (const methodData of created) {
        const { id: localId, ...newMethodData } = methodData;
        try {
          // بررسی وجود روش صید با همین نام
          let method = await FishingMethod.findOne({ name: newMethodData.name });

          if (method) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم
            Object.assign(method, newMethodData);
            await method.save();
            results.updated.push({ localId, serverId: method._id, status: 'merged' });
          } else {
            // اگر وجود نداشت، روش صید جدید را می‌سازیم
            method = new FishingMethod(newMethodData);
            await method.save();
            results.created.push({ localId, serverId: method._id });
          }
        } catch (error) {
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // پردازش روش‌های صید آپدیت شده
    if (updated && Array.isArray(updated)) {
      for (const methodData of updated) {
        const { id: serverId, ...updateData } = methodData;
        try {
          const updatedMethod = await FishingMethod.findByIdAndUpdate(
            serverId,
            { $set: updateData },
            { new: true, runValidators: true }
          );

          if (updatedMethod) {
            results.updated.push({ serverId, status: 'updated' });
          } else {
            results.errors.push({ id: serverId, error: 'روش صید برای آپدیت یافت نشد' });
          }
        } catch (error) {
          results.errors.push({ id: serverId, error: error.message });
        }
      }
    }

    // ارسال تمام روش‌های صید فعال به کلاینت
    const allMethods = await FishingMethod.find({ is_active: true }).sort({ name: 1 });

    res.json({
      success: true,
      message: 'همگام‌سازی روش‌های صید با موفقیت انجام شد',
      results,
      server_data: allMethods
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: `خطا در همگام‌سازی روش‌های صید: ${error.message}`
    });
  }
});

// 2. ثبت روش صید سفارشی
router.post('/fishing-methods/custom', async (req, res) => {
  try {
    const {
      name,
      name_en,
      description,
      requires_tools,
      min_crew_size,
      max_crew_size,
      custom_added_by
    } = req.body;

    // بررسی تکراری نبودن نام
    const existing = await FishingMethod.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'روش صید با این نام قبلاً ثبت شده است'
      });
    }

    const method = new FishingMethod({
      name,
      name_en,
      description,
      requires_tools,
      min_crew_size,
      max_crew_size,
      custom_added_by,
      approval_status: 'pending' // نیاز به تأیید
    });

    await method.save();

    res.status(201).json({
      success: true,
      message: 'روش صید سفارشی ثبت شد و در انتظار تأیید است',
      method
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🛠️ **مدیریت ابزارهای صید**

// 1. دریافت ابزارهای فعال
router.get('/fishing-tools', async (req, res) => {
  try {
    const { method_id } = req.query;

    let query = { is_active: true };
    if (method_id) {
      query.compatible_methods = method_id;
    }

    const tools = await FishingTool.find(query)
      .populate('compatible_methods', 'name')
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      tools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 1.5. همگام‌سازی ابزارهای صید
router.post('/fishing-tools/sync', async (req, res) => {
  try {
    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // پردازش ابزارهای صید جدید
    if (created && Array.isArray(created)) {
      for (const toolData of created) {
        const { id: localId, ...newToolData } = toolData;
        try {
          // بررسی وجود ابزار با همین نام
          let tool = await FishingTool.findOne({ name: newToolData.name });

          if (tool) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم
            Object.assign(tool, newToolData);
            await tool.save();
            results.updated.push({ localId, serverId: tool._id, status: 'merged' });
          } else {
            // اگر وجود نداشت، ابزار جدید را می‌سازیم
            tool = new FishingTool(newToolData);
            await tool.save();
            results.created.push({ localId, serverId: tool._id });
          }
        } catch (error) {
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // پردازش ابزارهای صید آپدیت شده
    if (updated && Array.isArray(updated)) {
      for (const toolData of updated) {
        const { id: serverId, ...updateData } = toolData;
        try {
          const updatedTool = await FishingTool.findByIdAndUpdate(
            serverId,
            { $set: updateData },
            { new: true, runValidators: true }
          );

          if (updatedTool) {
            results.updated.push({ serverId, status: 'updated' });
          } else {
            results.errors.push({ id: serverId, error: 'ابزار صید برای آپدیت یافت نشد' });
          }
        } catch (error) {
          results.errors.push({ id: serverId, error: error.message });
        }
      }
    }

    // ارسال تمام ابزارهای صید فعال به کلاینت
    const allTools = await FishingTool.find({ is_active: true })
      .populate('compatible_methods', 'name')
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      message: 'همگام‌سازی ابزارهای صید با موفقیت انجام شد',
      results,
      server_data: allTools
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: `خطا در همگام‌سازی ابزارهای صید: ${error.message}`
    });
  }
});

// 2. ثبت ابزار سفارشی
router.post('/fishing-tools/custom', async (req, res) => {
  try {
    const toolData = req.body;
    
    const tool = new FishingTool({
      ...toolData,
      approval_status: 'pending'
    });

    await tool.save();

    res.status(201).json({
      success: true,
      message: 'ابزار صید سفارشی ثبت شد و در انتظار تأیید است',
      tool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🏗️ **مدیریت انواع شناور**

// 1. دریافت انواع شناور
router.get('/boat-types', async (req, res) => {
  try {
    const types = await BoatType.find({ is_active: true })
      .populate('suitable_methods', 'name')
      .sort({ name: 1 });

    res.json({
      success: true,
      types
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 1.5. همگام‌سازی انواع شناور
router.post('/boat-types/sync', async (req, res) => {
  try {
    const { created, updated } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // پردازش انواع شناور جدید
    if (created && Array.isArray(created)) {
      for (const typeData of created) {
        const { id: localId, ...newTypeData } = typeData;
        try {
          // بررسی وجود نوع شناور با همین نام
          let boatType = await BoatType.findOne({ name: newTypeData.name });

          if (boatType) {
            // اگر وجود داشت، آن را آپدیت می‌کنیم
            Object.assign(boatType, newTypeData);
            await boatType.save();
            results.updated.push({ localId, serverId: boatType._id, status: 'merged' });
          } else {
            // اگر وجود نداشت، نوع شناور جدید را می‌سازیم
            boatType = new BoatType(newTypeData);
            await boatType.save();
            results.created.push({ localId, serverId: boatType._id });
          }
        } catch (error) {
          results.errors.push({ localId, error: error.message });
        }
      }
    }

    // پردازش انواع شناور آپدیت شده
    if (updated && Array.isArray(updated)) {
      for (const typeData of updated) {
        const { id: serverId, ...updateData } = typeData;
        try {
          const updatedType = await BoatType.findByIdAndUpdate(
            serverId,
            { $set: updateData },
            { new: true, runValidators: true }
          );

          if (updatedType) {
            results.updated.push({ serverId, status: 'updated' });
          } else {
            results.errors.push({ id: serverId, error: 'نوع شناور برای آپدیت یافت نشد' });
          }
        } catch (error) {
          results.errors.push({ id: serverId, error: error.message });
        }
      }
    }

    // ارسال تمام انواع شناور فعال به کلاینت
    const allTypes = await BoatType.find({ is_active: true })
      .populate('suitable_methods', 'name')
      .sort({ name: 1 });

    res.json({
      success: true,
      message: 'همگام‌سازی انواع شناور با موفقیت انجام شد',
      results,
      server_data: allTypes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: `خطا در همگام‌سازی انواع شناور: ${error.message}`
    });
  }
});

// 📊 **آمار و گزارش‌ها**

// 1. آمار کلی مالک
router.get('/stats/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;

    const stats = await Promise.all([
      Boat.countDocuments({ owner_id: ownerId }),
      Boat.countDocuments({ owner_id: ownerId, status: 'active' }),
      Boat.aggregate([
        { $match: { owner_id: mongoose.Types.ObjectId(ownerId) } },
        { $group: { _id: '$fishing_method_id', count: { $sum: 1 } } },
        { $lookup: { from: 'fishingmethods', localField: '_id', foreignField: '_id', as: 'method' } }
      ]),
      FishingActivity.countDocuments({ 
        'boat_id': { $in: await Boat.find({ owner_id: ownerId }).distinct('_id') }
      })
    ]);

    res.json({
      success: true,
      stats: {
        total_boats: stats[0],
        active_boats: stats[1],
        by_fishing_method: stats[2],
        total_activities: stats[3]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
