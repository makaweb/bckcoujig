// backend/seeders/boatTypeSeeder.js

const mongoose = require('mongoose');
require('dotenv').config();

// اتصال به MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// تعریف Schema برای BoatType
const boatTypeSchema = new mongoose.Schema({
  name_fa: { type: String, required: true },
  name_en: { type: String, required: true },
  description: { type: String },
  is_default: { type: Boolean, default: true },
  creator_id: { type: String, default: 'system' },
  synced: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const BoatType = mongoose.model('BoatType', boatTypeSchema);

// انواع شناور پیش‌فرض
const defaultBoatTypes = [
  {
    name_fa: 'فایبرگلاس',
    name_en: 'Fiberglass',
    description: 'شناور ساخته شده از فایبرگلاس',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار چوبی',
    name_en: 'Wooden Yekdar',
    description: 'شناور سنتی چوبی یکدار',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'لنج',
    name_en: 'Lenj',
    description: 'شناور سنتی لنج',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'لنج یخچالدار',
    name_en: 'Ice Lenj',
    description: 'لنج مجهز به یخچال',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار فایبرگلاس',
    name_en: 'Fiberglass Yekdar',
    description: 'یکدار ساخته شده از فایبرگلاس',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
  {
    name_fa: 'یکدار یخچالدار',
    name_en: 'Ice Yekdar',
    description: 'یکدار مجهز به یخچال',
    is_default: true,
    creator_id: 'system',
    synced: true,
  },
];

// تابع اصلی seed
const seedBoatTypes = async () => {
  try {
    console.log('🌱 Starting Boat Types Seeding...');

    // پاک کردن انواع شناور قبلی (اختیاری)
    const existingCount = await BoatType.countDocuments();
    console.log(`📊 Existing boat types: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Boat types already exist. Skipping seed...');
      console.log('💡 To force re-seed, delete existing boat types first.');
      return;
    }

    // درج انواع شناور پیش‌فرض
    const result = await BoatType.insertMany(defaultBoatTypes);
    console.log(`✅ Successfully seeded ${result.length} boat types`);

    // نمایش لیست
    console.log('\n📋 Seeded Boat Types:');
    result.forEach((type, index) => {
      console.log(`   ${index + 1}. ${type.name_fa} (${type.name_en})`);
    });

    console.log('\n🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding boat types:', error);
    throw error;
  }
};

// اجرای seeder
const run = async () => {
  try {
    await connectDB();
    await seedBoatTypes();
    console.log('\n✅ All done! Closing connection...');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// اجرا
run();
