import express from 'express';
import Settlement from '../models/Settlement.js';

const router = express.Router();

// POST /api/settlements
// ایجاد تسویه‌حساب جدید
router.post('/', async (req, res) => {
  try {
    const {
      settlement_number,
      boat_id,
      user_national_code,
      user_role,
      period_start,
      period_end,
      total_income,
      share_percentage,
      share_amount,
      expenses,
      net_amount,
      status,
      notes
    } = req.body;

    // Validation
    if (!settlement_number || !boat_id || !user_national_code || !user_role || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: settlement_number, boat_id, user_national_code, user_role, period_start, period_end'
      });
    }

    // بررسی تکراری نبودن شماره تسویه
    const existingSettlement = await Settlement.findOne({ settlement_number });
    if (existingSettlement) {
      return res.status(400).json({
        success: false,
        error: 'شماره تسویه‌حساب قبلاً ثبت شده است'
      });
    }

    // ایجاد تسویه‌حساب جدید
    const settlement = new Settlement({
      settlement_number,
      boat_id,
      user_national_code,
      user_role,
      period_start,
      period_end,
      total_income: total_income || 0,
      share_percentage: share_percentage || 0,
      share_amount: share_amount || 0,
      expenses: expenses || 0,
      net_amount: net_amount || 0,
      status: status || 'pending',
      notes
    });

    await settlement.save();

    return res.status(201).json({
      success: true,
      data: settlement,
      message: 'تسویه‌حساب با موفقیت ثبت شد'
    });
  } catch (error) {
    console.error('POST /settlements error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'شماره تسویه‌حساب تکراری است'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/settlements/boat/:boat_id
// دریافت لیست تسویه‌حساب‌های یک شناور
router.get('/boat/:boat_id', async (req, res) => {
  try {
    const { boat_id } = req.params;
    const { status, user_national_code } = req.query;

    const query = { boat_id };
    if (status) query.status = status;
    if (user_national_code) query.user_national_code = user_national_code;

    const settlements = await Settlement.find(query)
      .sort({ period_start: -1 })
      .lean();

    return res.json({
      success: true,
      data: settlements,
      count: settlements.length
    });
  } catch (error) {
    console.error('GET /settlements/boat error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/settlements/user/:national_code
// دریافت تسویه‌حساب‌های یک کاربر (ملوان/ناخدا/مالک)
router.get('/user/:national_code', async (req, res) => {
  try {
    const { national_code } = req.params;
    const { status } = req.query;

    const query = { user_national_code: national_code };
    if (status) query.status = status;

    const settlements = await Settlement.find(query)
      .populate('boat_id', 'boat_name boat_code')
      .sort({ period_start: -1 })
      .lean();

    return res.json({
      success: true,
      data: settlements,
      count: settlements.length
    });
  } catch (error) {
    console.error('GET /settlements/user error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/settlements/:id
// دریافت یک تسویه‌حساب خاص
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findById(id)
      .populate('boat_id', 'boat_name boat_code')
      .lean();

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: settlement
    });
  } catch (error) {
    console.error('GET /settlements/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/settlements/:id
// بروزرسانی تسویه‌حساب
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      total_income,
      share_percentage,
      share_amount,
      expenses,
      net_amount,
      status,
      payment_date,
      payment_method,
      payment_reference,
      notes
    } = req.body;

    const updateData = {};
    if (total_income !== undefined) updateData.total_income = total_income;
    if (share_percentage !== undefined) updateData.share_percentage = share_percentage;
    if (share_amount !== undefined) updateData.share_amount = share_amount;
    if (expenses !== undefined) updateData.expenses = expenses;
    if (net_amount !== undefined) updateData.net_amount = net_amount;
    if (status !== undefined) updateData.status = status;
    if (payment_date !== undefined) updateData.payment_date = payment_date;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (payment_reference !== undefined) updateData.payment_reference = payment_reference;
    if (notes !== undefined) updateData.notes = notes;

    const settlement = await Settlement.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: settlement,
      message: 'تسویه‌حساب با موفقیت بروزرسانی شد'
    });
  } catch (error) {
    console.error('PUT /settlements error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/settlements/:id/confirm-by-user
// تایید تسویه‌حساب توسط کاربر (ملوان/ناخدا)
router.put('/:id/confirm-by-user', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'confirmed_by_user',
          confirmed_by_user_at: new Date().toISOString()
        }
      },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: settlement,
      message: 'تسویه‌حساب توسط کاربر تایید شد'
    });
  } catch (error) {
    console.error('PUT /settlements/confirm-by-user error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/settlements/:id/confirm-by-owner
// تایید تسویه‌حساب توسط مالک
router.put('/:id/confirm-by-owner', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'confirmed_by_owner',
          confirmed_by_owner_at: new Date().toISOString()
        }
      },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: settlement,
      message: 'تسویه‌حساب توسط مالک تایید شد'
    });
  } catch (error) {
    console.error('PUT /settlements/confirm-by-owner error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/settlements/:id/mark-paid
// ثبت پرداخت تسویه‌حساب
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, payment_method, payment_reference } = req.body;

    const updateData = {
      status: 'paid',
      payment_date: payment_date || new Date().toISOString().split('T')[0]
    };

    if (payment_method) updateData.payment_method = payment_method;
    if (payment_reference) updateData.payment_reference = payment_reference;

    const settlement = await Settlement.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: settlement,
      message: 'پرداخت تسویه‌حساب ثبت شد'
    });
  } catch (error) {
    console.error('PUT /settlements/mark-paid error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// DELETE /api/settlements/:id
// حذف تسویه‌حساب
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByIdAndDelete(id);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'تسویه‌حساب یافت نشد'
      });
    }

    return res.json({
      success: true,
      message: 'تسویه‌حساب با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('DELETE /settlements error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// POST /api/settlements/sync
// همگام‌سازی دسته‌ای تسویه‌حساب‌ها
router.post('/sync', async (req, res) => {
  try {
    const { settlements } = req.body;

    if (!Array.isArray(settlements) || settlements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'آرایه settlements الزامی است'
      });
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const item of settlements) {
      try {
        const { settlement_number } = item;

        // بررسی وجود تسویه‌حساب
        const existingSettlement = await Settlement.findOne({ settlement_number });

        if (existingSettlement) {
          // بروزرسانی
          Object.keys(item).forEach(key => {
            if (key !== '_id' && key !== 'settlement_number' && item[key] !== undefined) {
              existingSettlement[key] = item[key];
            }
          });

          await existingSettlement.save();
          results.updated.push({
            id: existingSettlement._id,
            settlement_number
          });
        } else {
          // ایجاد جدید
          const newSettlement = new Settlement(item);
          await newSettlement.save();
          results.created.push({
            id: newSettlement._id,
            settlement_number
          });
        }
      } catch (error) {
        results.errors.push({
          settlement: item,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      results,
      message: 'همگام‌سازی تسویه‌حساب‌ها انجام شد'
    });
  } catch (error) {
    console.error('POST /settlements/sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

export default router;
