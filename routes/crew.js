import express from 'express';
import User from '../models/User.js';

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

export default router;


