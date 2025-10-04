import express from 'express';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import smsService from '../services/smsService.js';

const router = express.Router();

// 📱 ارسال کد تأیید
router.post('/send-code', async (req, res) => {
  try {
  const { mobile, type } = req.body;
  const m = String(mobile || '').trim();

    // Validation
  if (!m || !/^09\d{9}$/.test(m)) {
      return res.status(400).json({
        success: false,
        error: 'شماره موبایل معتبر نیست'
      });
    }

  // تولید کد 6 رقمی
    const code = Math.floor(100000 + Math.random() * 900000).toString();
  const ttlSec = parseInt(process.env.VERIFICATION_TTL_SEC || '120'); // default: 2m
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
    
    // ذخیره کد در دیتابیس
  const verifyType = type || 'verification';
  const savedDoc = await Verification.findOneAndUpdate(
      { mobile: m, type: verifyType },
      {
        mobile: m,
        code,
        type: verifyType,
    expiresAt: expiresAt,
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    if (process.env.NODE_ENV === 'development' && savedDoc) {
      console.log('🔐 verification doc saved', {
        id: savedDoc._id,
        mobile: savedDoc.mobile,
        code: savedDoc.code,
        isUsed: savedDoc.isUsed,
        attempts: savedDoc.attempts,
        expiresAt: savedDoc.expiresAt,
        createdAt: savedDoc.createdAt,
        updatedAt: savedDoc.updatedAt
      });
    }

    // ارسال پیامک واقعی
  const smsResult = await smsService.sendVerificationCode(m, code);
    
  console.log(`📤 کد تأیید برای ${m}: ${code}`);
    console.log('📱 نتیجه ارسال پیامک:', smsResult);

    // پاسخ به اپلیکیشن
    const response = {
      success: true,
      message: 'کد تأیید ارسال شد',
  mobile: m
    };

    // فقط در صورت اجازه صریح (ALLOW_DEV_CODE=true) کد را برگردان
    if (process.env.ALLOW_DEV_CODE === 'true') {
      response.code = code;
      response.dev_mode = true;
      response.expiresAt = expiresAt;
      response.ttlSec = ttlSec;
    }

    // اگر پیامک ارسال نشد ولی کد ذخیره شد، کد رو برگردون
    if (!smsResult.success && smsResult.fallback_code) {
      response.code = smsResult.fallback_code;
      response.fallback = true;
      response.sms_error = smsResult.error;
    }

    res.json(response);

  } catch (error) {
    console.error('خطا در ارسال کد:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ✅ تأیید کد
router.post('/verify-code', async (req, res) => {
  try {
    let { mobile, code, type } = req.body;
    mobile = String(mobile || '').trim();
    code = String(code || '').trim();
    
    console.log('🔎 verify-code request:', { mobile, code, type });

    // Validation
    if (!mobile || !code) {
      return res.status(400).json({
        success: false,
        error: 'موبایل و کد تأیید الزامی است'
      });
    }

    // پیدا کردن کد از دیتابیس - اگر type مشخص نشده، از همه type ها جستجو کن
    const queryFilter = {
      mobile,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    };
    
    // اگر type مشخص شده، آن را به query اضافه کن
    if (type) {
      queryFilter.type = type;
    }
    
    const verification = await Verification.findOne(queryFilter);
    
    console.log('🔎 verification lookup result:', verification ? {
      id: verification._id,
      mobile: verification.mobile,
      code: verification.code,
      type: verification.type,
      isUsed: verification.isUsed,
      attempts: verification.attempts,
      expiresAt: verification.expiresAt
    } : null);

    if (!verification) {
      const resp = {
        success: false,
        error: 'کد تأیید یافت نشد یا منقضی شده'
      };
  if (process.env.ALLOW_DEV_DEBUG === 'true') {
        // give extra hints for local debugging
        const now = new Date();
        const activeCount = await Verification.countDocuments({ mobile, isUsed: false, expiresAt: { $gt: now } });
        const totalCount = await Verification.countDocuments({ mobile });
        const latest = await Verification.findOne({ mobile }).sort({ createdAt: -1 }).lean();
        resp.debug = 'no_active_verification_found';
        resp.debugDetails = {
          activeCount,
          totalCount,
          serverNow: now,
          requestedType: type,
          latest: latest ? {
            id: latest._id,
            mobile: latest.mobile,
            code: latest.code,
            type: latest.type,
            isUsed: latest.isUsed,
            expiresAt: latest.expiresAt,
            attempts: latest.attempts,
            createdAt: latest.createdAt,
            updatedAt: latest.updatedAt
          } : null
        };
      }
      return res.status(400).json(resp);
    }

    // بررسی تعداد تلاش‌ها
  if (verification.attempts >= 3) {
      await Verification.deleteOne({ _id: verification._id });
      const resp = {
        success: false,
        error: 'تعداد تلاش‌های مجاز تمام شده'
      };
  if (process.env.ALLOW_DEV_DEBUG === 'true') resp.debug = 'max_attempts_reached';
      return res.status(400).json(resp);
    }

    // بررسی کد
    if (verification.code !== code.toString()) {
      verification.attempts += 1;
      await verification.save();
      const resp = {
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      };
  if (process.env.ALLOW_DEV_DEBUG === 'true') resp.debug = { expected: verification.code };
      return res.status(400).json(resp);
    }

    // کد درست است - علامت‌گذاری به عنوان استفاده شده
    verification.isUsed = true;
    await verification.save();

    const successResponse = {
      success: true,
      verified: true,
      message: 'کد تأیید شد',
      mobile: mobile
    };

    console.log('✅ verify-code SUCCESS response:', successResponse);
    console.log('📤 Sending response to Flutter:', JSON.stringify(successResponse, null, 2));
    res.json(successResponse);

  } catch (error) {
    console.error('خطا در تأیید کد:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// ✅ تأیید کد و ثبت نام همزمان
router.post('/verify-and-register', async (req, res) => {
  try {
    const { mobile, code, nationalCode, name, role } = req.body;

    // Validation
    if (!mobile || !code || !nationalCode || !name) {
      return res.status(400).json({
        success: false,
        error: 'موبایل، کد تأیید، کدملی و نام الزامی است'
      });
    }

    // پیدا کردن کد از دیتابیس
    // اول کد unused رو چک کن، اگه نبود کد recently used رو چک کن (5 دقیقه گذشته)
    let verification = await Verification.findOne({
      mobile,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    // اگر کد unused پیدا نشد، کد recently used رو چک کن
    if (!verification) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      verification = await Verification.findOne({
        mobile,
        isUsed: true,
        expiresAt: { $gt: new Date() },
        updatedAt: { $gte: fiveMinutesAgo } // recently used
      });
    }

    console.log('🔎 verify-and-register lookup result:', verification ? {
      id: verification._id,
      code: verification.code,
      isUsed: verification.isUsed,
      attempts: verification.attempts,
      expiresAt: verification.expiresAt,
      updatedAt: verification.updatedAt
    } : null);

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
    if (verification.code !== code.toString()) {
      verification.attempts += 1;
      await verification.save();
      
      return res.status(400).json({
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      });
    }

    // کد درست است - حالا کاربر رو ثبت می‌کنیم

    // بررسی تکراری بودن موبایل
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        error: 'این شماره موبایل قبلاً ثبت شده است'
      });
    }

    // بررسی تکراری بودن کدملی
    const existingNationalCode = await User.findOne({ nationalCode });
    if (existingNationalCode) {
      return res.status(400).json({
        success: false,
        error: 'این کدملی قبلاً ثبت شده است'
      });
    }

    // ثبت کاربر جدید
    const user = new User({
      mobile,
      nationalCode,
      name,
      avatar: null, // فعلاً null، بعداً از شاهکار پر می‌شه
      role: role || 'owner',
      isVerified: true, // موبایل تأیید شده
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await user.save();

    // علامت‌گذاری کد به عنوان استفاده شده
    verification.isUsed = true;
    await verification.save();

    res.json({
      success: true,
      verified: true,
      registered: true,
      message: 'کد تأیید شد و کاربر ثبت شد',
      user: {
        id: user._id,
        mobile: user.mobile,
        nationalCode: user.nationalCode,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('خطا در تأیید و ثبت نام:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 🔍 بررسی وجود کاربر قبل از ثبت نام
router.post('/check-duplicate', async (req, res) => {
  try {
    const { mobile, nationalCode } = req.body;

    const duplicateChecks = [];

    if (mobile) {
      const existingMobile = await User.findOne({ mobile });
      if (existingMobile) {
        duplicateChecks.push('شماره موبایل قبلاً ثبت شده است');
      }
    }

    if (nationalCode) {
      const existingNationalCode = await User.findOne({ nationalCode });
      if (existingNationalCode) {
        duplicateChecks.push('کدملی قبلاً ثبت شده است');
      }
    }

    res.json({
      success: true,
      exists: duplicateChecks.length > 0,
      errors: duplicateChecks
    });

  } catch (error) {
    console.error('خطا در بررسی تکراری:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 👤 ثبت نام کاربر
router.post('/register', async (req, res) => {
  try {
    const { mobile, nationalCode, name, role } = req.body;

    // Validation
    if (!mobile || !nationalCode || !name) {
      return res.status(400).json({
        success: false,
        error: 'موبایل، کدملی و نام الزامی است'
      });
    }

    // بررسی تکراری بودن موبایل
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        error: 'این شماره موبایل قبلاً ثبت شده است'
      });
    }

    // بررسی تکراری بودن کدملی
    const existingNationalCode = await User.findOne({ nationalCode });
    if (existingNationalCode) {
      return res.status(400).json({
        success: false,
        error: 'این کدملی قبلاً ثبت شده است'
      });
    }

    // ثبت کاربر جدید
    const user = new User({
      mobile,
      nationalCode,
      name,
      role: role || 'owner',
      isVerified: true, // موبایل از قبل تأیید شده
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'کاربر با موفقیت ثبت شد',
      user: {
        id: user._id,
        mobile: user.mobile,
        nationalCode: user.nationalCode,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('خطا در ثبت نام:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 🔍 بررسی وجود کاربر
router.post('/check-user', async (req, res) => {
  try {
    const { mobile, nationalCode } = req.body;

    let query = {};
    if (mobile) query.mobile = mobile;
    if (nationalCode) query.nationalCode = nationalCode;

    const user = await User.findOne(query);

    res.json({
      success: true,
      exists: !!user,
      user: user ? {
        mobile: user.mobile,
        nationalCode: user.nationalCode,
        name: user.name,
        role: user.role
      } : null
    });

  } catch (error) {
    console.error('خطا در بررسی کاربر:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 📊 مشاهده وضعیت دیتابیس (فقط برای development)
router.get('/db-status', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const verificationCount = await Verification.countDocuments();
    const activeVerifications = await Verification.countDocuments({ 
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    // مثال‌هایی از کاربران (فقط 5 تا)
    const sampleUsers = await User.find({}, 'mobile name role createdAt').limit(5);
    
    // مثال‌هایی از کدهای تأیید فعال
    const activeCodes = await Verification.find({ 
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }, 'mobile code expiresAt attempts').limit(5);

    res.json({
      success: true,
      database: {
        users: {
          total: userCount,
          samples: sampleUsers
        },
        verifications: {
          total: verificationCount,
          active: activeVerifications,
          activeCodes: activeCodes
        }
      },
      collections_status: userCount > 0 || verificationCount > 0 ? 'Created' : 'Will be created on first use',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطا در بررسی وضعیت دیتابیس:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// بروزرسانی رمز عبور
router.post('/update-password', async (req, res) => {
  try {
    const { mobile, nationalCode, passwordHash } = req.body;

    // Validation
    if (!mobile || !nationalCode || !passwordHash) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات ناقص است'
      });
    }

    // پیدا کردن کاربر
    const user = await User.findOne({ mobile, nationalCode });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'کاربر یافت نشد'
      });
    }

    console.log('🔑 [Server] Updating password for user:', {
      id: user._id,
      mobile: user.mobile,
      nationalCode: user.nationalCode,
      oldPasswordHashLength: user.passwordHash?.length || 0,
      newPasswordHashLength: passwordHash.length
    });

    // بروزرسانی رمز عبور
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
    await user.save();

    console.log('✅ [Server] Password updated successfully');

    res.json({
      success: true,
      message: 'رمز عبور با موفقیت بروزرسانی شد'
    });

  } catch (error) {
    console.error('❌ [Server] Error updating password:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 🔧 Development helper: list active verifications (only in development)
router.get('/debug/verifications', async (req, res) => {
  if (process.env.ALLOW_DEV_DEBUG !== 'true') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  try {
    const { mobile } = req.query;
    const query = {
      isUsed: false,
      expiresAt: { $gt: new Date() }
    };
    if (mobile) query.mobile = mobile;

    const verifications = await Verification.find(query).lean();
    res.json({ success: true, count: verifications.length, verifications });
  } catch (error) {
    console.error('خطا در debug/verifications:', error);
    res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  }
});

// 🔐 ورود با OTP (بدون رمز عبور)
router.post('/login-with-otp', async (req, res) => {
  try {
    const { mobile, code } = req.body;

    // Validation
    if (!mobile || !code) {
      return res.status(400).json({
        success: false,
        error: 'شماره موبایل و کد تأیید الزامی است'
      });
    }

    console.log('🔐 login-with-otp request:', { mobile, code });

    // بررسی وجود کاربر
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'کاربری با این شماره موبایل یافت نشد'
      });
    }

    // بررسی تایید شدن کاربر
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'حساب کاربری شما هنوز تایید نشده است. لطفاً با پشتیبانی تماس بگیرید.',
        isVerified: false,
        user: {
          mobile: user.mobile,
          name: user.name,
          nationalCode: user.nationalCode
        }
      });
    }

    // تایید کد OTP
    const verification = await Verification.findOne({
      mobile,
      isUsed: false,
      expiresAt: { $gt: new Date() },
      type: 'login' // فقط کدهای login
    });

    console.log('🔎 OTP verification lookup:', verification ? {
      id: verification._id,
      code: verification.code,
      isUsed: verification.isUsed,
      attempts: verification.attempts,
      expiresAt: verification.expiresAt
    } : null);

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید یافت نشد یا منقضی شده است'
      });
    }

    // بررسی تعداد تلاش‌ها
    if (verification.attempts >= 3) {
      await Verification.deleteOne({ _id: verification._id });
      return res.status(400).json({
        success: false,
        error: 'تعداد تلاش‌های مجاز تمام شده است'
      });
    }

    // بررسی کد
    if (verification.code !== code.toString()) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({
        success: false,
        error: 'کد تأیید اشتباه است',
        remainingAttempts: 3 - verification.attempts
      });
    }

    // کد درست است - ورود موفق
    verification.isUsed = true;
    await verification.save();

    // به‌روزرسانی آخرین ورود
    user.lastLoginAt = new Date();
    await user.save();

    console.log('✅ OTP login successful for user:', user.mobile);

    res.json({
      success: true,
      message: 'ورود با موفقیت انجام شد',
      user: {
        id: user._id,
        mobile: user.mobile,
        nationalCode: user.nationalCode,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
        createdBy: user.createdBy
      }
    });

  } catch (error) {
    console.error('❌ خطا در ورود با OTP:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 📱 ارسال کد OTP برای ورود
router.post('/send-login-otp', async (req, res) => {
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

    // بررسی وجود کاربر
    const user = await User.findOne({ mobile: m });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'کاربری با این شماره موبایل یافت نشد'
      });
    }

    // بررسی تایید شدن کاربر
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'حساب کاربری شما هنوز تایید نشده است. لطفاً با پشتیبانی تماس بگیرید.',
        isVerified: false,
        user: {
          mobile: user.mobile,
          name: user.name,
          nationalCode: user.nationalCode
        }
      });
    }

    // تولید کد 6 رقمی
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSec = parseInt(process.env.VERIFICATION_TTL_SEC || '120');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    // ذخیره کد در دیتابیس
    const savedDoc = await Verification.findOneAndUpdate(
      { mobile: m, type: 'login' },
      {
        mobile: m,
        code,
        type: 'login',
        expiresAt: expiresAt,
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    console.log('🔐 Login OTP saved:', {
      mobile: m,
      code: code,
      expiresAt: expiresAt
    });

    // ارسال پیامک
    const smsResult = await smsService.sendVerificationCode(m, code);
    console.log(`📤 کد ورود برای ${m}: ${code}`);
    console.log('📱 نتیجه ارسال پیامک:', smsResult);

    // پاسخ به اپلیکیشن
    const response = {
      success: true,
      message: 'کد تأیید برای ورود ارسال شد',
      mobile: m,
      user: {
        name: user.name,
        isVerified: user.isVerified
      }
    };

    // فقط در development کد را برگردان
    if (process.env.ALLOW_DEV_CODE === 'true') {
      response.code = code;
      response.dev_mode = true;
      response.expiresAt = expiresAt;
      response.ttlSec = ttlSec;
    }

    // اگر پیامک ارسال نشد، کد را برگردان
    if (!smsResult.success && smsResult.fallback_code) {
      response.code = smsResult.fallback_code;
      response.fallback = true;
      response.sms_error = smsResult.error;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ خطا در ارسال کد ورود:', error);
    res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// 🧪 تست تولید کد (برای دیباگ)
router.get('/test-code', (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  res.json({
    success: true,
    test_code: code,
    length: code.length,
    timestamp: new Date().toISOString()
  });
});

export default router;
