import express from 'express';
import mongoose from 'mongoose';
import FishingActivity from '../models/FishingActivity.js';

const router = express.Router();

// POST /api/fishing-activities
// ایجاد فعالیت صید جدید
router.post('/', async (req, res) => {
  try {
    const {
      boat_id,
      fishing_method_id,
      start_date,
      end_date,
      fishing_area,
      crew_details,
      tool_details,
      catch_results,
      expenses,
      owner_income,
      notes,
      created_by,
      status
    } = req.body;

    // Validation
    if (!boat_id || !start_date || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: boat_id, start_date, created_by'
      });
    }

    // ایجاد فعالیت صید جدید
    const activity = new FishingActivity({
      boat_id,
      fishing_method_id,
      start_date,
      end_date,
      fishing_area,
      crew_details,
      tool_details,
      catch_results,
      expenses,
      owner_income: owner_income || 0,
      notes,
      created_by,
      status: status || 'planned'
    });

    await activity.save();

    return res.status(201).json({
      success: true,
      data: activity,
      message: 'فعالیت صید با موفقیت ثبت شد'
    });
  } catch (error) {
    console.error('POST /fishing-activities error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/fishing-activities/boat/:boat_id
// دریافت لیست فعالیت‌های صید یک شناور
router.get('/boat/:boat_id', async (req, res) => {
  try {
    const { boat_id } = req.params;
    const { status, start_date_from, start_date_to } = req.query;

    const query = { boat_id };
    if (status) query.status = status;
    if (start_date_from || start_date_to) {
      query.start_date = {};
      if (start_date_from) query.start_date.$gte = start_date_from;
      if (start_date_to) query.start_date.$lte = start_date_to;
    }

    const activities = await FishingActivity.find(query)
      .sort({ start_date: -1 })
      .populate('fishing_method_id', 'name_fa name_en')
      .lean();

    return res.json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    console.error('GET /fishing-activities/boat error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/fishing-activities/owner/:owner_national_code
// دریافت تمام فعالیت‌های صید یک مالک
router.get('/owner/:owner_national_code', async (req, res) => {
  try {
    const { owner_national_code } = req.params;
    const { status } = req.query;

    const query = { created_by: owner_national_code };
    if (status) query.status = status;

    const activities = await FishingActivity.find(query)
      .sort({ start_date: -1 })
      .populate('boat_id', 'boat_name boat_code')
      .populate('fishing_method_id', 'name_fa name_en')
      .lean();

    return res.json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    console.error('GET /fishing-activities/owner error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/fishing-activities/:id
// دریافت یک فعالیت صید خاص
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await FishingActivity.findById(id)
      .populate('boat_id', 'boat_name boat_code')
      .populate('fishing_method_id', 'name_fa name_en')
      .lean();

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت صید یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('GET /fishing-activities/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/fishing-activities/:id
// بروزرسانی فعالیت صید
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fishing_method_id,
      start_date,
      end_date,
      fishing_area,
      crew_details,
      tool_details,
      catch_results,
      expenses,
      owner_income,
      notes,
      status,
      last_updated_by
    } = req.body;

    const updateData = {};
    if (fishing_method_id !== undefined) updateData.fishing_method_id = fishing_method_id;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (fishing_area !== undefined) updateData.fishing_area = fishing_area;
    if (crew_details !== undefined) updateData.crew_details = crew_details;
    if (tool_details !== undefined) updateData.tool_details = tool_details;
    if (catch_results !== undefined) updateData.catch_results = catch_results;
    if (expenses !== undefined) updateData.expenses = expenses;
    if (owner_income !== undefined) updateData.owner_income = owner_income;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (last_updated_by !== undefined) updateData.last_updated_by = last_updated_by;

    const activity = await FishingActivity.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت صید یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: activity,
      message: 'فعالیت صید با موفقیت بروزرسانی شد'
    });
  } catch (error) {
    console.error('PUT /fishing-activities error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/fishing-activities/:id/status
// تغییر وضعیت فعالیت صید
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'فیلد status الزامی است'
      });
    }

    const validStatuses = ['planned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `وضعیت باید یکی از موارد زیر باشد: ${validStatuses.join(', ')}`
      });
    }

    const activity = await FishingActivity.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت صید یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: activity,
      message: 'وضعیت فعالیت صید تغییر کرد'
    });
  } catch (error) {
    console.error('PUT /fishing-activities/status error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// DELETE /api/fishing-activities/:id
// حذف فعالیت صید
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await FishingActivity.findByIdAndDelete(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'فعالیت صید یافت نشد'
      });
    }

    return res.json({
      success: true,
      message: 'فعالیت صید با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('DELETE /fishing-activities error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// POST /api/fishing-activities/sync
// همگام‌سازی دسته‌ای فعالیت‌های صید
router.post('/sync', async (req, res) => {
  try {
    const { activities } = req.body;

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'آرایه activities الزامی است'
      });
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const item of activities) {
      try {
        const { _id, boat_id, start_date, created_by } = item;

        if (_id) {
          // بروزرسانی
          const existingActivity = await FishingActivity.findById(_id);
          
          if (existingActivity) {
            Object.keys(item).forEach(key => {
              if (key !== '_id' && item[key] !== undefined) {
                existingActivity[key] = item[key];
              }
            });

            await existingActivity.save();
            results.updated.push({ id: existingActivity._id });
          } else {
            results.errors.push({
              activity: item,
              error: 'فعالیت یافت نشد'
            });
          }
        } else {
          // ایجاد جدید
          if (!boat_id || !start_date || !created_by) {
            results.errors.push({
              activity: item,
              error: 'فیلدهای الزامی: boat_id, start_date, created_by'
            });
            continue;
          }

          const newActivity = new FishingActivity(item);
          await newActivity.save();
          results.created.push({ id: newActivity._id });
        }
      } catch (error) {
        results.errors.push({
          activity: item,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      results,
      message: 'همگام‌سازی فعالیت‌های صید انجام شد'
    });
  } catch (error) {
    console.error('POST /fishing-activities/sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/fishing-activities/statistics/boat/:boat_id
// آمار فعالیت‌های صید یک شناور
router.get('/statistics/boat/:boat_id', async (req, res) => {
  try {
    const { boat_id } = req.params;

    const statistics = await FishingActivity.aggregate([
      { $match: { boat_id: new mongoose.Types.ObjectId(boat_id) } },
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          totalIncome: { $sum: '$owner_income' },
          completedActivities: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          inProgressActivities: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          plannedActivities: {
            $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] }
          }
        }
      }
    ]);

    return res.json({
      success: true,
      data: statistics.length > 0 ? statistics[0] : {
        totalActivities: 0,
        totalIncome: 0,
        completedActivities: 0,
        inProgressActivities: 0,
        plannedActivities: 0
      }
    });
  } catch (error) {
    console.error('GET /fishing-activities/statistics error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

export default router;
