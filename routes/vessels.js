const express = require('express');
const router = express.Router();
const Vessel = require('../models/Vessel');

// دریافت شناورهای نزدیک
// query: lat, lon, radiusKm
router.get('/nearby', async (req, res) => {
  const { lat, lon, radius } = req.query;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  const radiusKm = parseFloat(radius) || 10;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'lat and lon required' });
  }

  try {
    // تبدیل شعاع به رادیان (MongoDB $geoWithin)
    const earthRadiusKm = 6371;
    const radiusRad = radiusKm / earthRadiusKm;

    // اطمینان از داشتن ایندکس مکانی روی latitude و longitude
    // در MongoDB: db.vessels.createIndex({location: "2dsphere"})
    const vessels = await Vessel.find({
      location: {
        $geoWithin: { $centerSphere: [[longitude, latitude], radiusRad] },
      },
    }).lean();

    res.json(vessels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// آپدیت لوکیشن شناور
// body: { userId, name, latitude, longitude }
router.post('/update', async (req, res) => {
  const { userId, name, latitude, longitude } = req.body;
  if (!userId || !latitude || !longitude || !name) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // ذخیره یا آپدیت لوکیشن شناور
    const vessel = await Vessel.findOneAndUpdate(
      { userId },
      {
        userId,
        name,
        latitude,
        longitude,
        updatedAt: new Date(),
        location: { type: 'Point', coordinates: [longitude, latitude] }, // geojson
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, vessel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
