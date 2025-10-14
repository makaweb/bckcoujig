import express from 'express';
import CrewMember from '../models/CrewMember.js';

const router = express.Router();

// POST /api/crew-members
// ایجاد خدمه جدید
router.post('/', async (req, res) => {
  try {
    const {
      boat_id,
      national_code,
      name,
      role,
      share_percentage,
      assignment_date,
      end_date,
      is_active,
      notes,
      owner_id
    } = req.body;

    // Validation
    if (!boat_id || !national_code || !name || !role || !assignment_date || !owner_id) {
      return res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: boat_id, national_code, name, role, assignment_date, owner_id'
      });
    }

    // بررسی تکراری نبودن
    const existingMember = await CrewMember.findOne({
      boat_id,
      national_code,
      is_active: 1
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: 'این فرد قبلاً به عنوان خدمه این شناور ثبت شده است'
      });
    }

    // ایجاد خدمه جدید
    const crewMember = new CrewMember({
      boat_id,
      national_code,
      name,
      role,
      share_percentage: share_percentage || 0,
      assignment_date,
      end_date,
      is_active: is_active !== undefined ? is_active : 1,
      notes,
      owner_id
    });

    await crewMember.save();

    return res.status(201).json({
      success: true,
      data: crewMember,
      message: 'خدمه با موفقیت ثبت شد'
    });
  } catch (error) {
    console.error('POST /crew-members error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'این فرد قبلاً به این شناور اضافه شده است'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/crew-members/boat/:boat_id
// دریافت لیست خدمه یک شناور
router.get('/boat/:boat_id', async (req, res) => {
  try {
    const { boat_id } = req.params;
    const { is_active } = req.query;

    const query = { boat_id };
    if (is_active !== undefined) {
      query.is_active = parseInt(is_active);
    }

    const crewMembers = await CrewMember.find(query)
      .sort({ assignment_date: -1 })
      .lean();

    return res.json({
      success: true,
      data: crewMembers,
      count: crewMembers.length
    });
  } catch (error) {
    console.error('GET /crew-members/boat error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// GET /api/crew-members/owner/:owner_id
// دریافت تمام خدمه‌های یک مالک
router.get('/owner/:owner_id', async (req, res) => {
  try {
    const { owner_id } = req.params;
    const { is_active } = req.query;

    const query = { owner_id };
    if (is_active !== undefined) {
      query.is_active = parseInt(is_active);
    }

    const crewMembers = await CrewMember.find(query)
      .populate('boat_id', 'boat_name boat_code')
      .sort({ assignment_date: -1 })
      .lean();

    return res.json({
      success: true,
      data: crewMembers,
      count: crewMembers.length
    });
  } catch (error) {
    console.error('GET /crew-members/owner error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// PUT /api/crew-members/:id
// بروزرسانی اطلاعات خدمه
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      share_percentage,
      assignment_date,
      end_date,
      is_active,
      notes
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (share_percentage !== undefined) updateData.share_percentage = share_percentage;
    if (assignment_date !== undefined) updateData.assignment_date = assignment_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (notes !== undefined) updateData.notes = notes;

    const crewMember = await CrewMember.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!crewMember) {
      return res.status(404).json({
        success: false,
        error: 'خدمه یافت نشد'
      });
    }

    return res.json({
      success: true,
      data: crewMember,
      message: 'اطلاعات خدمه با موفقیت بروزرسانی شد'
    });
  } catch (error) {
    console.error('PUT /crew-members error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// DELETE /api/crew-members/:id
// حذف (غیرفعال کردن) خدمه
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      // حذف دائمی
      const crewMember = await CrewMember.findByIdAndDelete(id);
      
      if (!crewMember) {
        return res.status(404).json({
          success: false,
          error: 'خدمه یافت نشد'
        });
      }

      return res.json({
        success: true,
        message: 'خدمه به طور دائم حذف شد'
      });
    } else {
      // غیرفعال کردن
      const crewMember = await CrewMember.findByIdAndUpdate(
        id,
        {
          $set: {
            is_active: 0,
            end_date: new Date().toISOString().split('T')[0]
          }
        },
        { new: true }
      );

      if (!crewMember) {
        return res.status(404).json({
          success: false,
          error: 'خدمه یافت نشد'
        });
      }

      return res.json({
        success: true,
        data: crewMember,
        message: 'خدمه غیرفعال شد'
      });
    }
  } catch (error) {
    console.error('DELETE /crew-members error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

// POST /api/crew-members/sync
// همگام‌سازی دسته‌ای خدمه
router.post('/sync', async (req, res) => {
  try {
    const { crew_members } = req.body;

    if (!Array.isArray(crew_members) || crew_members.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'آرایه crew_members الزامی است'
      });
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const member of crew_members) {
      try {
        const {
          boat_id,
          national_code,
          name,
          role,
          share_percentage,
          assignment_date,
          end_date,
          is_active,
          notes,
          owner_id
        } = member;

        // بررسی وجود خدمه
        const existingMember = await CrewMember.findOne({
          boat_id,
          national_code
        });

        if (existingMember) {
          // بروزرسانی
          existingMember.name = name || existingMember.name;
          existingMember.role = role || existingMember.role;
          existingMember.share_percentage = share_percentage !== undefined ? share_percentage : existingMember.share_percentage;
          existingMember.assignment_date = assignment_date || existingMember.assignment_date;
          existingMember.end_date = end_date !== undefined ? end_date : existingMember.end_date;
          existingMember.is_active = is_active !== undefined ? is_active : existingMember.is_active;
          existingMember.notes = notes !== undefined ? notes : existingMember.notes;

          await existingMember.save();
          results.updated.push({
            id: existingMember._id,
            national_code
          });
        } else {
          // ایجاد جدید
          const newMember = new CrewMember({
            boat_id,
            national_code,
            name,
            role,
            share_percentage: share_percentage || 0,
            assignment_date,
            end_date,
            is_active: is_active !== undefined ? is_active : 1,
            notes,
            owner_id
          });

          await newMember.save();
          results.created.push({
            id: newMember._id,
            national_code
          });
        }
      } catch (error) {
        results.errors.push({
          member,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      results,
      message: 'همگام‌سازی خدمه انجام شد'
    });
  } catch (error) {
    console.error('POST /crew-members/sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'خطای داخلی سرور'
    });
  }
});

export default router;
