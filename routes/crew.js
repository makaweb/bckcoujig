import express from 'express';
import User from '../models/User.js';
import CrewMember from '../models/CrewMember.js';

const router = express.Router();

// GET /api/crew/:ownerNationalCode
// لیست خدمه‌ای که توسط یک مالک خاص ثبت شده‌اند را برمی‌گرداند
router.get('/:ownerNationalCode', async (req, res) => {
  try {
    const { ownerNationalCode } = req.params;

    if (!ownerNationalCode || ownerNationalCode.length !== 10) {
      return res.status(400).json({ success: false, error: 'کد ملی مالک نامعتبر است' });
    }

    const crew = await User.find({ createdBy: ownerNationalCode, role: { $in: ['captain', 'sailor'] } })
      .select('name mobile nationalCode role isVerified createdBy createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, crew });
  } catch (error) {
    console.error('GET /crew error:', error);
    return res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

// POST /api/crew/custom
// ایجاد/به‌روزرسانی خدمه‌ای که کاربر به‌صورت سفارشی ثبت می‌کند
router.post('/custom', async (req, res) => {
  try {
    const { name, mobile, nationalCode, role = 'sailor', createdBy, isVerified = false } = req.body || {};

    if (!name || !mobile || !nationalCode || !createdBy) {
      return res.status(400).json({ success: false, error: 'نام، موبایل، کد ملی و createdBy الزامی است' });
    }

    if (!/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, error: 'شماره موبایل نامعتبر است' });
    }

    if (String(nationalCode).length !== 10) {
      return res.status(400).json({ success: false, error: 'کد ملی نامعتبر است' });
    }

    const update = {
      name,
      mobile,
      nationalCode,
      role,
      isVerified: !!isVerified,
      createdBy,
      updatedAt: new Date(),
    };

    const user = await User.findOneAndUpdate(
      { nationalCode },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    return res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('POST /crew/custom error:', error);
    return res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

// POST /api/crew/sync
// در صورت نیاز: همگام‌سازی دسته‌ای خدمه (created/updated)
router.post('/sync', async (req, res) => {
  try {
    const { created = [], updated = [] } = req.body || {};

    const results = { created: [], updated: [], errors: [] };

    // پردازش ایجاد
    for (const item of created) {
      try {
        const { name, mobile, nationalCode, role = 'sailor', createdBy, isVerified = false } = item;
        if (!name || !mobile || !nationalCode || !createdBy) {
          results.errors.push({ item, error: 'نام/موبایل/کدملی/createdBy اجباری' });
          continue;
        }
        const user = await User.findOneAndUpdate(
          { nationalCode },
          { $set: { name, mobile, nationalCode, role, isVerified: !!isVerified, createdBy, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { new: true, upsert: true }
        ).lean();
        results.created.push({ nationalCode: user.nationalCode });
      } catch (e) {
        results.errors.push({ item, error: e.message });
      }
    }

    // پردازش بروزرسانی
    for (const item of updated) {
      try {
        const { name, mobile, nationalCode, role, isVerified, createdBy } = item;
        if (!nationalCode) {
          results.errors.push({ item, error: 'کدملی الزامی است' });
          continue;
        }
        const user = await User.findOneAndUpdate(
          { nationalCode },
          { $set: { ...(name && { name }), ...(mobile && { mobile }), ...(role && { role }), ...(createdBy && { createdBy }), ...(isVerified !== undefined && { isVerified: !!isVerified }), updatedAt: new Date() } },
          { new: true }
        ).lean();
        if (user) results.updated.push({ nationalCode: user.nationalCode });
        else results.errors.push({ item, error: 'پیدا نشد' });
      } catch (e) {
        results.errors.push({ item, error: e.message });
      }
    }

    return res.json({ success: true, results, message: 'همگام‌سازی خدمه انجام شد' });
  } catch (error) {
    console.error('POST /crew/sync error:', error);
    return res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

// GET /api/crew/sailors/:nationalCode/current-boat
// دریافت شناور فعال یک ملوان (بهینه‌شده برای پنل ملوان)
router.get('/sailors/:nationalCode/current-boat', async (req, res) => {
  try {
    const { nationalCode } = req.params;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({ success: false, error: 'کد ملی ملوان نامعتبر است' });
    }

    // پیدا کردن خدمه فعال این ملوان
    const crewMember = await CrewMember.findOne({
      national_code: nationalCode,
      is_active: 1
    })
      .sort({ assignment_date: -1 })
      .lean();

    if (!crewMember) {
      return res.json({ 
        success: true, 
        data: null, 
        message: 'ملوان در حال حاضر در شناوری فعالیت نمی‌کند' 
      });
    }

    // دریافت اطلاعات کامل شناور
    const Boat = (await import('../models/Boat.js')).default;
    const User = (await import('../models/User.js')).default;
    const BoatType = (await import('../models/BoatType.js')).default;
    const FishingMethod = (await import('../models/FishingMethod.js')).default;
    const FishingTool = (await import('../models/FishingTool.js')).default;

    const boat = await Boat.findById(crewMember.boat_id).lean();

    if (!boat) {
      return res.status(404).json({ 
        success: false, 
        error: 'شناور یافت نشد' 
      });
    }

    // 1. دریافت نام کامل مالک
    let ownerName = boat.owner_id || null;
    if (boat.owner_id) {
      const owner = await User.findOne({ national_code: boat.owner_id }).lean();
      if (owner) {
        ownerName = owner.name;
      }
    }

    // 2. دریافت نام کامل ناخدا (اگر وجود دارد)
    let captainName = boat.captain_id || null;
    if (boat.captain_id) {
      const captain = await User.findOne({ national_code: boat.captain_id }).lean();
      if (captain) {
        captainName = captain.name;
      }
    }

    // 3. دریافت نوع شناور
    let boatTypeName = boat.boat_type || null;
    if (boat.boat_type_id) {
      const boatType = await BoatType.findById(boat.boat_type_id).lean();
      if (boatType) {
        boatTypeName = boatType.name_fa || boatType.name;
      }
    }

    // 4. دریافت روش صید
    let fishingMethodName = boat.fishing_type || null;
    if (boat.fishing_method_id) {
      const fishingMethod = await FishingMethod.findById(boat.fishing_method_id).lean();
      if (fishingMethod) {
        fishingMethodName = fishingMethod.name_fa || fishingMethod.name;
      }
    }

    // 5. تعداد خدمه فعال
    const crewCount = await CrewMember.countDocuments({
      boat_id: boat._id,
      is_active: 1
    });

    // 6. دریافت اسامی ابزار صید (اگر وجود دارد)
    let installedToolsNames = [];
    if (boat.installed_tools && Array.isArray(boat.installed_tools) && boat.installed_tools.length > 0) {
      const tools = await FishingTool.find({
        _id: { $in: boat.installed_tools }
      }).lean();
      
      installedToolsNames = tools.map(tool => tool.name_fa || tool.name);
    }

    // 7. دریافت لیست کامل خدمه
    const allCrew = await CrewMember.find({
      boat_id: boat._id,
      is_active: 1
    }).lean();

    const crewList = await Promise.all(allCrew.map(async (crew) => {
      let crewName = crew.name || crew.national_code;
      
      // اگر نام نداشت، از جدول users بگیر
      if (!crew.name || crew.name === crew.national_code) {
        const user = await User.findOne({ national_code: crew.national_code }).lean();
        if (user) {
          crewName = user.name;
        }
      }

      return {
        _id: crew._id,
        national_code: crew.national_code,
        name: crewName,
        role: crew.role,
        share_percentage: crew.share_percentage,
        assignment_date: crew.assignment_date,
        is_active: crew.is_active
      };
    }));

    // ساختار داده کامل و بهینه‌شده
    const optimizedBoatData = {
      _id: boat._id,
      boat_name: boat.boat_name,
      boat_code: boat.boat_code,
      registration_date: boat.registration_date,
      documents: boat.documents,
      fuel_quota: boat.fuel_quota,
      boat_type: boatTypeName,
      fishing_type: fishingMethodName,
      installed_tools: installedToolsNames, // اسامی ابزار
      status: boat.status,
      owner_id: boat.owner_id,
      owner_name: ownerName, // نام کامل مالک
      captain_id: boat.captain_id,
      captain_name: captainName, // نام کامل ناخدا
      crew_count: crewCount, // تعداد خدمه
      invoice_period: boat.invoice_period,
      settlement_period: boat.settlement_period,
      min_crew: boat.min_crew,
      max_crew: boat.max_crew,
      crew_list: crewList, // لیست کامل خدمه
      synced: 1,
      createdAt: boat.createdAt,
      updatedAt: boat.updatedAt,
    };

    // اطلاعات خدمه فعلی ملوان
    const optimizedCrewData = {
      _id: crewMember._id,
      boat_id: crewMember.boat_id,
      national_code: crewMember.national_code,
      name: crewMember.name,
      role: crewMember.role,
      share_percentage: crewMember.share_percentage,
      assignment_date: crewMember.assignment_date,
      end_date: crewMember.end_date,
      is_active: crewMember.is_active,
      notes: crewMember.notes,
      owner_id: crewMember.owner_id,
      synced: 0,
      createdAt: crewMember.createdAt,
      updatedAt: crewMember.updatedAt,
    };

    return res.json({ 
      success: true, 
      data: optimizedBoatData,
      crewMember: optimizedCrewData,
      message: 'شناور فعال ملوان با موفقیت دریافت شد'
    });
  } catch (error) {
    console.error('GET /crew/sailors/:nationalCode/current-boat error:', error);
    return res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

// GET /api/crew/sailors/:nationalCode/boats-history
// دریافت تمام شناورهایی که ملوان در آن‌ها فعالیت داشته (گذشته و حال)
router.get('/sailors/:nationalCode/boats-history', async (req, res) => {
  try {
    const { nationalCode } = req.params;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({ success: false, error: 'کد ملی ملوان نامعتبر است' });
    }

    // پیدا کردن تمام سوابق کار این ملوان
    const crewHistory = await CrewMember.find({
      national_code: nationalCode
    })
      .sort({ assignment_date: -1 })
      .lean();

    if (!crewHistory || crewHistory.length === 0) {
      return res.json({ 
        success: true, 
        boats: [],
        count: 0,
        message: 'هیچ سابقه فعالیتی برای این ملوان یافت نشد' 
      });
    }

    // دریافت اطلاعات شناورها
    const Boat = (await import('../models/Boat.js')).default;
    const BoatType = (await import('../models/BoatType.js')).default;
    const FishingMethod = (await import('../models/FishingMethod.js')).default;

    const boatIds = [...new Set(crewHistory.map(c => c.boat_id))];
    const boats = await Boat.find({ _id: { $in: boatIds } }).lean();

    // بهینه‌سازی داده‌ها برای ملوان
    const optimizedBoats = await Promise.all(boats.map(async (boat) => {
      // دریافت عنوان نوع شناور
      let boatTypeName = null;
      if (boat.boat_type_id) {
        const boatType = await BoatType.findById(boat.boat_type_id).lean();
        boatTypeName = boatType ? boatType.name : null;
      }

      // دریافت عنوان روش صید
      let fishingMethodName = null;
      if (boat.fishing_method_id) {
        const fishingMethod = await FishingMethod.findById(boat.fishing_method_id).lean();
        fishingMethodName = fishingMethod ? fishingMethod.name : null;
      }

      // پیدا کردن سابقه کار ملوان در این شناور
      const crewRecord = crewHistory.find(c => c.boat_id.toString() === boat._id.toString());

      return {
        // اطلاعات شناور (بدون ID های غیرضروری)
        _id: boat._id,
        boat_name: boat.boat_name,
        boat_code: boat.boat_code,
        registration_date: boat.registration_date,
        documents: boat.documents,
        fuel_quota: boat.fuel_quota,
        boat_type: boatTypeName, // عنوان به جای ID
        fishing_type: fishingMethodName, // عنوان به جای ID
        status: boat.status,
        owner_id: boat.owner_id,
        captain_id: boat.captain_id,
        invoice_period: boat.invoice_period,
        settlement_period: boat.settlement_period,
        min_crew: boat.min_crew,
        max_crew: boat.max_crew,
        synced: 1,
        createdAt: boat.createdAt,
        updatedAt: boat.updatedAt,
        
        // اطلاعات خدمه در این شناور
        crew_info: {
          role: crewRecord?.role,
          share_percentage: crewRecord?.share_percentage,
          assignment_date: crewRecord?.assignment_date,
          end_date: crewRecord?.end_date,
          is_active: crewRecord?.is_active,
          notes: crewRecord?.notes,
        }
      };
    }));

    // مرتب‌سازی: ابتدا شناورهای فعال، سپس غیرفعال (بر اساس تاریخ)
    optimizedBoats.sort((a, b) => {
      if (a.crew_info.is_active !== b.crew_info.is_active) {
        return b.crew_info.is_active - a.crew_info.is_active;
      }
      return new Date(b.crew_info.assignment_date) - new Date(a.crew_info.assignment_date);
    });

    return res.json({ 
      success: true, 
      boats: optimizedBoats,
      count: optimizedBoats.length,
      message: `${optimizedBoats.length} شناور یافت شد`
    });
  } catch (error) {
    console.error('GET /crew/sailors/:nationalCode/boats-history error:', error);
    return res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

export default router;


