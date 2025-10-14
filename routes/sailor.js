import express from 'express';
import User from '../models/User.js';
import Boat from '../models/Boat.js';
import FishingActivity from '../models/FishingActivity.js';
import Verification from '../models/Verification.js';
import smsService from '../services/smsService.js';

const router = express.Router();

// ============================================
// 🔐 احراز هویت ملوان
// ============================================

/**
 * POST /api/sailor/auth/send-code
 * ارسال کد تأیید برای ملوان
 * ملوان فقط می‌تواند با شماره‌ای که مالک او را ثبت کرده وارد شود
 */
router.post('/auth/send-code', async (req, res) => {
  try {
    const { mobile } = req.body;
    const m = String(mobile || '').trim();

    // Validation
    if (!m || !/^09\d{9}$/.test(m)) {
      return res.status(400).json({
        success: false,
        error: 'شماره موبایل معتبر نیست'
      });
    }

    // بررسی اینکه این شماره توسط یک مالک ثبت شده باشد
    const sailor = await User.findOne({ 
      mobile: m, 
      role: { $in: ['sailor', 'captain', 'engineer', 'cook'] },
      createdBy: { $ne: null } // باید توسط مالک ثبت شده باشد
    });

    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'شماره موبایل شما در سیستم ثبت نشده است. لطفاً از مالک/ناخدا بخواهید شما را ثبت کند.'
      });
    }

    // تولید کد 6 رقمی
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSec = parseInt(process.env.VERIFICATION_TTL_SEC || '120');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    
    // ذخیره کد در دیتابیس
    await Verification.findOneAndUpdate(
      { mobile: m, type: 'login' },
      {
        mobile: m,
        code,
        type: 'login',
        expiresAt: expiresAt,
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // ارسال پیامک
    const smsResult = await smsService.sendVerificationCode(m, code);
    
    console.log(`📤 کد تأیید ملوان برای ${m}: ${code}`);

    const response = {
      success: true,
      message: 'کد تأیید ارسال شد',
      mobile: m,
      sailorName: sailor.name
    };

    // در حالت توسعه کد را برگردان
    if (process.env.ALLOW_DEV_CODE === 'true') {
      response.code = code;
      response.dev_mode = true;
    }

    if (!smsResult.success && smsResult.fallback_code) {
      response.code = smsResult.fallback_code;
      response.fallback = true;
    }

    res.json(response);

  } catch (error) {
    console.error('خطا در ارسال کد ملوان:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * POST /api/sailor/auth/verify-code
 * تأیید کد و ورود ملوان
 */
router.post('/auth/verify-code', async (req, res) => {
  try {
    let { mobile, code } = req.body;
    mobile = String(mobile || '').trim();
    code = String(code || '').trim();

    if (!mobile || !code) {
      return res.status(400).json({
        success: false,
        error: 'موبایل و کد تأیید الزامی است'
      });
    }

    // پیدا کردن کد
    const verification = await Verification.findOne({
      mobile,
      type: 'login',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید یافت نشد یا منقضی شده'
      });
    }

    // بررسی تعداد تلاش‌ها
    if (verification.attempts >= 3) {
      await Verification.deleteOne({ _id: verification._id });
      return res.status(400).json({
        success: false,
        error: 'تعداد تلاش‌های مجاز تمام شده'
      });
    }

    // بررسی کد
    if (verification.code !== code) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      });
    }

    // کد درست است
    verification.isUsed = true;
    await verification.save();

    // دریافت اطلاعات ملوان
    const sailor = await User.findOne({ mobile })
      .select('_id mobile nationalCode name avatar role isVerified createdBy createdAt')
      .lean();

    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'کاربر یافت نشد'
      });
    }

    // به‌روزرسانی آخرین ورود و تایید کاربر (چون با OTP وارد شده)
    await User.updateOne(
      { _id: sailor._id },
      { 
        $set: { 
          lastLoginAt: new Date(),
          isVerified: true 
        } 
      }
    );
    
    // به‌روزرسانی sailor object برای response
    sailor.isVerified = true;

    res.json({
      success: true,
      verified: true,
      message: 'ورود موفقیت‌آمیز',
      user: sailor
    });

  } catch (error) {
    console.error('خطا در تأیید کد ملوان:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 🚤 قایق‌های ملوان
// ============================================

/**
 * GET /api/sailor/boats/:nationalCode
 * دریافت لیست قایق‌هایی که ملوان در آن‌ها عضو است یا بوده
 */
router.get('/boats/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    // پیدا کردن ملوان
    const sailor = await User.findOne({ nationalCode });
    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'ملوان یافت نشد'
      });
    }

    // پیدا کردن فعالیت‌های صید که این ملوان در آن‌ها شرکت داشته
    const activities = await FishingActivity.find({
      'crew.nationalCode': nationalCode
    }).distinct('boat_id');

    // دریافت اطلاعات قایق‌ها
    const boats = await Boat.find({
      _id: { $in: activities }
    })
    .populate('boat_type_id', 'name_fa name_en')
    .populate('fishing_method_id', 'name_fa name_en')
    .populate('owner_id', 'name mobile')
    .populate('captain_id', 'name mobile')
    .lean();

    res.json({
      success: true,
      boats: boats.map(boat => ({
        id: boat._id,
        name: boat.boat_name,
        code: boat.boat_code,
        type: boat.boat_type_id,
        fishingMethod: boat.fishing_method_id,
        owner: boat.owner_id,
        captain: boat.captain_id,
        status: boat.status,
        minCrew: boat.min_crew,
        maxCrew: boat.max_crew
      }))
    });

  } catch (error) {
    console.error('خطا در دریافت قایق‌های ملوان:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * GET /api/sailor/boat/:boatId/details
 * دریافت جزئیات یک قایق
 */
router.get('/boat/:boatId/details', async (req, res) => {
  try {
    const { boatId } = req.params;
    const { sailorNationalCode } = req.query;

    if (!sailorNationalCode) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی ملوان الزامی است'
      });
    }

    // بررسی دسترسی ملوان به این قایق
    const hasAccess = await FishingActivity.findOne({
      boat_id: boatId,
      'crew.nationalCode': sailorNationalCode
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'شما به این قایق دسترسی ندارید'
      });
    }

    const boat = await Boat.findById(boatId)
      .populate('boat_type_id')
      .populate('fishing_method_id')
      .populate('owner_id', 'name mobile')
      .populate('captain_id', 'name mobile')
      .lean();

    if (!boat) {
      return res.status(404).json({
        success: false,
        error: 'قایق یافت نشد'
      });
    }

    res.json({
      success: true,
      boat
    });

  } catch (error) {
    console.error('خطا در دریافت جزئیات قایق:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 🎣 فعالیت‌های صید
// ============================================

/**
 * GET /api/sailor/activities/:nationalCode
 * دریافت فعالیت‌های صید ملوان
 */
router.get('/activities/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;
    const { boatId, startDate, endDate, page = 1, limit = 20 } = req.query;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    const query = {
      'crew.nationalCode': nationalCode
    };

    if (boatId) {
      query.boat_id = boatId;
    }

    if (startDate || endDate) {
      query.start_date = {};
      if (startDate) query.start_date.$gte = new Date(startDate);
      if (endDate) query.start_date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      FishingActivity.find(query)
        .populate('boat_id', 'boat_name boat_code')
        .sort({ start_date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FishingActivity.countDocuments(query)
    ]);

    res.json({
      success: true,
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('خطا در دریافت فعالیت‌های ملوان:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * GET /api/sailor/activity/:activityId
 * دریافت جزئیات یک فعالیت صید
 */
router.get('/activity/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { sailorNationalCode } = req.query;

    if (!sailorNationalCode) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی ملوان الزامی است'
      });
    }

    const activity = await FishingActivity.findById(activityId)
      .populate('boat_id')
      .lean();

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت یافت نشد'
      });
    }

    // بررسی دسترسی
    const hasAccess = activity.crew.some(
      c => c.nationalCode === sailorNationalCode
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'شما به این فعالیت دسترسی ندارید'
      });
    }

    res.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error('خطا در دریافت جزئیات فعالیت:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 👥 همکاران خدمه
// ============================================

/**
 * GET /api/sailor/crew/:boatId
 * دریافت لیست خدمه یک قایق
 */
router.get('/crew/:boatId', async (req, res) => {
  try {
    const { boatId } = req.params;
    const { sailorNationalCode } = req.query;

    if (!sailorNationalCode) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی ملوان الزامی است'
      });
    }

    // بررسی دسترسی
    const hasAccess = await FishingActivity.findOne({
      boat_id: boatId,
      'crew.nationalCode': sailorNationalCode
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'شما به این قایق دسترسی ندارید'
      });
    }

    // دریافت آخرین فعالیت برای دیدن خدمه فعلی
    const latestActivity = await FishingActivity.findOne({
      boat_id: boatId
    })
    .sort({ start_date: -1 })
    .lean();

    if (!latestActivity) {
      return res.json({
        success: true,
        crew: []
      });
    }

    // دریافت اطلاعات کامل خدمه
    const crewNationalCodes = latestActivity.crew.map(c => c.nationalCode);
    const crewMembers = await User.find({
      nationalCode: { $in: crewNationalCodes }
    })
    .select('name mobile nationalCode role avatar')
    .lean();

    res.json({
      success: true,
      crew: crewMembers
    });

  } catch (error) {
    console.error('خطا در دریافت خدمه:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 💰 تسویه‌حساب‌ها
// ============================================

/**
 * GET /api/sailor/settlements/:nationalCode
 * دریافت تسویه‌حساب‌های ملوان
 */
router.get('/settlements/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;
    const { boatId, startDate, endDate, page = 1, limit = 20 } = req.query;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    // پیدا کردن فعالیت‌هایی که ملوان در آن‌ها بوده
    const query = {
      'crew.nationalCode': nationalCode
    };

    if (boatId) {
      query.boat_id = boatId;
    }

    if (startDate || endDate) {
      query.start_date = {};
      if (startDate) query.start_date.$gte = new Date(startDate);
      if (endDate) query.start_date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      FishingActivity.find(query)
        .populate('boat_id', 'boat_name boat_code')
        .sort({ start_date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FishingActivity.countDocuments(query)
    ]);

    // محاسبه سهم ملوان از هر فعالیت
    const settlements = activities.map(activity => {
      const sailorShare = activity.crew.find(
        c => c.nationalCode === nationalCode
      );

      return {
        activityId: activity._id,
        boat: activity.boat_id,
        date: activity.start_date,
        totalIncome: activity.total_income || 0,
        totalExpense: activity.total_expense || 0,
        sailorShare: sailorShare?.share || 0,
        sailorIncome: sailorShare?.income || 0,
        status: activity.settlement_status || 'pending'
      };
    });

    res.json({
      success: true,
      settlements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('خطا در دریافت تسویه‌حساب‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 🔔 نوتیفیکیشن‌ها
// ============================================

/**
 * GET /api/sailor/notifications/:nationalCode
 * دریافت نوتیفیکیشن‌های ملوان
 */
router.get('/notifications/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    // TODO: باید یک مدل Notification ایجاد شود
    // فعلاً یک پاسخ نمونه برمی‌گردانیم

    res.json({
      success: true,
      notifications: [],
      message: 'سیستم نوتیفیکیشن در حال توسعه است'
    });

  } catch (error) {
    console.error('خطا در دریافت نوتیفیکیشن‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 📝 اعتراض به فاکتور
// ============================================

/**
 * POST /api/sailor/dispute
 * ثبت اعتراض به فاکتور صید
 */
router.post('/dispute', async (req, res) => {
  try {
    const { activityId, sailorNationalCode, reason, description } = req.body;

    if (!activityId || !sailorNationalCode || !reason) {
      return res.status(400).json({
        success: false,
        error: 'شناسه فعالیت، کد ملی و دلیل اعتراض الزامی است'
      });
    }

    // بررسی دسترسی
    const activity = await FishingActivity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت یافت نشد'
      });
    }

    const hasAccess = activity.crew.some(
      c => c.nationalCode === sailorNationalCode
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'شما به این فعالیت دسترسی ندارید'
      });
    }

    // TODO: باید یک مدل Dispute ایجاد شود
    // فعلاً فقط در activity ذخیره می‌کنیم

    if (!activity.disputes) {
      activity.disputes = [];
    }

    activity.disputes.push({
      sailorNationalCode,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    });

    await activity.save();

    res.json({
      success: true,
      message: 'اعتراض شما ثبت شد و به مالک/ناخدا اطلاع داده خواهد شد'
    });

  } catch (error) {
    console.error('خطا در ثبت اعتراض:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 👤 پروفایل ملوان
// ============================================

/**
 * GET /api/sailor/profile/:nationalCode
 * دریافت اطلاعات پروفایل ملوان
 */
router.get('/profile/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    const sailor = await User.findOne({ nationalCode })
      .select('-passwordHash')
      .lean();

    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'ملوان یافت نشد'
      });
    }

    res.json({
      success: true,
      profile: sailor
    });

  } catch (error) {
    console.error('خطا در دریافت پروفایل:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * PUT /api/sailor/profile/:nationalCode
 * ویرایش اطلاعات پروفایل ملوان
 * ملوان فقط می‌تواند نام خود را ویرایش کند
 */
router.put('/profile/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;
    const { name } = req.body;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'نام الزامی است'
      });
    }

    const sailor = await User.findOneAndUpdate(
      { nationalCode },
      { $set: { name: name.trim(), updatedAt: new Date() } },
      { new: true }
    ).select('-passwordHash');

    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'ملوان یافت نشد'
      });
    }

    res.json({
      success: true,
      message: 'پروفایل به‌روزرسانی شد',
      profile: sailor
    });

  } catch (error) {
    console.error('خطا در ویرایش پروفایل:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * POST /api/sailor/change-mobile/request
 * درخواست تغییر شماره موبایل - مرحله 1: تأیید شماره فعلی
 */
router.post('/change-mobile/request', async (req, res) => {
  try {
    const { nationalCode, currentMobile } = req.body;

    if (!nationalCode || !currentMobile) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی و شماره فعلی الزامی است'
      });
    }

    // بررسی وجود کاربر
    const sailor = await User.findOne({ nationalCode, mobile: currentMobile });
    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'کاربر با این مشخصات یافت نشد'
      });
    }

    // ارسال کد تأیید به شماره فعلی
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSec = parseInt(process.env.VERIFICATION_TTL_SEC || '120');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    
    await Verification.findOneAndUpdate(
      { mobile: currentMobile, type: 'change_mobile_verify_current' },
      {
        mobile: currentMobile,
        code,
        type: 'change_mobile_verify_current',
        expiresAt,
        attempts: 0,
        isUsed: false,
        metadata: { nationalCode } // برای مرحله بعد
      },
      { upsert: true, new: true }
    );

    const smsResult = await smsService.sendVerificationCode(currentMobile, code);
    
    console.log(`📤 کد تأیید تغییر موبایل (مرحله 1) برای ${currentMobile}: ${code}`);

    const response = {
      success: true,
      message: 'کد تأیید به شماره فعلی ارسال شد'
    };

    if (process.env.ALLOW_DEV_CODE === 'true') {
      response.code = code;
    }

    res.json(response);

  } catch (error) {
    console.error('خطا در درخواست تغییر موبایل:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * POST /api/sailor/change-mobile/verify-current
 * تأیید شماره فعلی - مرحله 2
 */
router.post('/change-mobile/verify-current', async (req, res) => {
  try {
    const { currentMobile, code } = req.body;

    if (!currentMobile || !code) {
      return res.status(400).json({
        success: false,
        error: 'شماره فعلی و کد تأیید الزامی است'
      });
    }

    const verification = await Verification.findOne({
      mobile: currentMobile,
      type: 'change_mobile_verify_current',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید یافت نشد یا منقضی شده'
      });
    }

    if (verification.code !== code) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      });
    }

    // کد درست است
    verification.isUsed = true;
    await verification.save();

    res.json({
      success: true,
      message: 'شماره فعلی تأیید شد. اکنون شماره جدید را وارد کنید',
      verified: true
    });

  } catch (error) {
    console.error('خطا در تأیید شماره فعلی:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * POST /api/sailor/change-mobile/send-new
 * ارسال کد به شماره جدید - مرحله 3
 */
router.post('/change-mobile/send-new', async (req, res) => {
  try {
    const { nationalCode, currentMobile, newMobile } = req.body;

    if (!nationalCode || !currentMobile || !newMobile) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی، شماره فعلی و شماره جدید الزامی است'
      });
    }

    if (!/^09\d{9}$/.test(newMobile)) {
      return res.status(400).json({
        success: false,
        error: 'شماره موبایل جدید معتبر نیست'
      });
    }

    // بررسی اینکه شماره فعلی تأیید شده باشد
    const currentVerified = await Verification.findOne({
      mobile: currentMobile,
      type: 'change_mobile_verify_current',
      isUsed: true
    });

    if (!currentVerified) {
      return res.status(400).json({
        success: false,
        error: 'ابتدا باید شماره فعلی را تأیید کنید'
      });
    }

    // بررسی تکراری نبودن شماره جدید
    const existingUser = await User.findOne({ mobile: newMobile });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'این شماره قبلاً ثبت شده است'
      });
    }

    // ارسال کد به شماره جدید
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSec = parseInt(process.env.VERIFICATION_TTL_SEC || '120');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    
    await Verification.findOneAndUpdate(
      { mobile: newMobile, type: 'change_mobile_verify_new' },
      {
        mobile: newMobile,
        code,
        type: 'change_mobile_verify_new',
        expiresAt,
        attempts: 0,
        isUsed: false,
        metadata: { nationalCode, currentMobile }
      },
      { upsert: true, new: true }
    );

    const smsResult = await smsService.sendVerificationCode(newMobile, code);
    
    console.log(`📤 کد تأیید تغییر موبایل (مرحله 3) برای ${newMobile}: ${code}`);

    const response = {
      success: true,
      message: 'کد تأیید به شماره جدید ارسال شد'
    };

    if (process.env.ALLOW_DEV_CODE === 'true') {
      response.code = code;
    }

    res.json(response);

  } catch (error) {
    console.error('خطا در ارسال کد به شماره جدید:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

/**
 * POST /api/sailor/change-mobile/confirm
 * تأیید شماره جدید و تغییر نهایی - مرحله 4
 */
router.post('/change-mobile/confirm', async (req, res) => {
  try {
    const { nationalCode, newMobile, code } = req.body;

    if (!nationalCode || !newMobile || !code) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی، شماره جدید و کد تأیید الزامی است'
      });
    }

    const verification = await Verification.findOne({
      mobile: newMobile,
      type: 'change_mobile_verify_new',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید یافت نشد یا منقضی شده'
      });
    }

    if (verification.code !== code) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      });
    }

    // کد درست است - شماره را تغییر می‌دهیم
    const sailor = await User.findOneAndUpdate(
      { nationalCode },
      { $set: { mobile: newMobile, updatedAt: new Date() } },
      { new: true }
    ).select('-passwordHash');

    if (!sailor) {
      return res.status(404).json({
        success: false,
        error: 'کاربر یافت نشد'
      });
    }

    verification.isUsed = true;
    await verification.save();

    // پاک کردن verification های قدیمی
    await Verification.deleteMany({
      mobile: verification.metadata?.currentMobile,
      type: { $in: ['change_mobile_verify_current', 'change_mobile_verify_new'] }
    });

    res.json({
      success: true,
      message: 'شماره موبایل با موفقیت تغییر کرد',
      profile: sailor
    });

  } catch (error) {
    console.error('خطا در تأیید شماره جدید:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ============================================
// 📊 آمار ملوان
// ============================================

/**
 * GET /api/sailor/stats/:nationalCode
 * دریافت آمار کلی ملوان
 */
router.get('/stats/:nationalCode', async (req, res) => {
  try {
    const { nationalCode } = req.params;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'کد ملی نامعتبر است'
      });
    }

    // تعداد کل فعالیت‌ها
    const totalActivities = await FishingActivity.countDocuments({
      'crew.nationalCode': nationalCode
    });

    // تعداد قایق‌های مختلف
    const boats = await FishingActivity.find({
      'crew.nationalCode': nationalCode
    }).distinct('boat_id');

    // محاسبه درآمد کل
    const activities = await FishingActivity.find({
      'crew.nationalCode': nationalCode
    }).lean();

    let totalIncome = 0;
    activities.forEach(activity => {
      const sailorShare = activity.crew.find(
        c => c.nationalCode === nationalCode
      );
      if (sailorShare) {
        totalIncome += sailorShare.income || 0;
      }
    });

    // آخرین فعالیت
    const lastActivity = await FishingActivity.findOne({
      'crew.nationalCode': nationalCode
    })
    .sort({ start_date: -1 })
    .populate('boat_id', 'boat_name')
    .lean();

    res.json({
      success: true,
      stats: {
        totalActivities,
        totalBoats: boats.length,
        totalIncome,
        lastActivity: lastActivity ? {
          date: lastActivity.start_date,
          boat: lastActivity.boat_id?.boat_name
        } : null
      }
    });

  } catch (error) {
    console.error('خطا در دریافت آمار:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

export default router;
