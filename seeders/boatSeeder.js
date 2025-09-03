import mongoose from 'mongoose';
import FishingMethod from '../models/FishingMethod.js';
import BoatType from '../models/BoatType.js';
import FishingTool from '../models/FishingTool.js';

// 🎣 **روش‌های صید پیش‌فرض**
const defaultFishingMethods = [
  {
    name: "چیرآپ",
    name_en: "Chirp Net",
    description: "شبکه چیرآپ برای صید ماهی‌های سطحی",
    requires_tools: true,
    min_crew_size: 3,
    max_crew_size: 8,
    seasonal_restrictions: [
      { start_month: 3, end_month: 8, description: "فصل اصلی صید" }
    ]
  },
  {
    name: "سرآپ",
    name_en: "Surface Net",
    description: "شبکه سرآپ برای صید در آب‌های کم عمق",
    requires_tools: true,
    min_crew_size: 2,
    max_crew_size: 6
  },
  {
    name: "قلاب",
    name_en: "Hook Fishing",
    description: "صید با قلاب برای ماهی‌های بزرگ",
    requires_tools: true,
    min_crew_size: 1,
    max_crew_size: 4
  },
  {
    name: "برام",
    name_en: "Beam Trawl",
    description: "تور کشی با برام",
    requires_tools: true,
    min_crew_size: 4,
    max_crew_size: 10
  },
  {
    name: "لانگ لاین",
    name_en: "Long Line",
    description: "ماهیگیری با طناب بلند",
    requires_tools: true,
    min_crew_size: 2,
    max_crew_size: 6
  },
  {
    name: "محاصره",
    name_en: "Purse Seine",
    description: "محاصره کردن ماهی‌ها با تور",
    requires_tools: true,
    min_crew_size: 6,
    max_crew_size: 15
  },
  {
    name: "ماهی مرکب",
    name_en: "Composite Fishing",
    description: "ترکیب چندین روش صید",
    requires_tools: true,
    min_crew_size: 3,
    max_crew_size: 12
  },
  {
    name: "پنجرو",
    name_en: "Panjaro",
    description: "روش صید محلی پنجرو",
    requires_tools: true,
    min_crew_size: 2,
    max_crew_size: 5
  }
];

// 🚤 **انواع شناور پیش‌فرض**
const defaultBoatTypes = [
  {
    name: "قایق فایبرگلاس",
    name_en: "Fiberglass Boat",
    description: "قایق‌های مدرن فایبرگلاس مناسب برای صید",
    typical_length_range: { min: 8, max: 25 },
    typical_crew_capacity: { min: 2, max: 8 },
    fuel_efficiency: "medium",
    maintenance_requirements: {
      frequency: "هر 6 ماه",
      estimated_cost: "متوسط",
      special_needs: ["نظافت بدنه", "چک موتور", "تعویض روغن"]
    }
  },
  {
    name: "یکدار (قایق چوبی)",
    name_en: "Ykdar (Wooden Boat)",
    description: "قایق‌های سنتی چوبی محلی",
    typical_length_range: { min: 6, max: 20 },
    typical_crew_capacity: { min: 1, max: 6 },
    fuel_efficiency: "high",
    maintenance_requirements: {
      frequency: "هر 3 ماه",
      estimated_cost: "کم",
      special_needs: ["آب‌بندی", "رنگ‌آمیزی", "تعمیر چوب"]
    }
  },
  {
    name: "لنج",
    name_en: "Lenj",
    description: "شناورهای بزرگ سنتی خلیج فارس",
    typical_length_range: { min: 15, max: 40 },
    typical_crew_capacity: { min: 5, max: 20 },
    fuel_efficiency: "low",
    maintenance_requirements: {
      frequency: "هر 4 ماه",
      estimated_cost: "بالا",
      special_needs: ["تعمیرات اساسی", "بازسازی بدنه", "تجهیزات ایمنی"]
    }
  }
];

// 🛠️ **ابزارهای صید پیش‌فرض**
const defaultFishingTools = [
  {
    name: "شبکه چیرآپ",
    name_en: "Chirp Net",
    category: "net",
    specifications: {
      size: "50×20 متر",
      material: "نایلون",
      weight: "15 کیلوگرم"
    },
    maintenance_required: true,
    maintenance_interval_days: 30
  },
  {
    name: "قلاب بزرگ",
    name_en: "Large Hook",
    category: "hook",
    specifications: {
      size: "سایز 8/0",
      material: "فولاد ضد زنگ"
    },
    maintenance_required: false
  },
  {
    name: "سونار ماهی‌یاب",
    name_en: "Fish Finder Sonar",
    category: "electronic",
    specifications: {
      frequency: "50/200 کیلوهرتز",
      depth_range: "تا 300 متر"
    },
    maintenance_required: true,
    maintenance_interval_days: 90
  },
  {
    name: "وینچ شبکه",
    name_en: "Net Winch",
    category: "mechanical",
    specifications: {
      capacity: "500 کیلوگرم",
      power: "موتور هیدرولیک"
    },
    maintenance_required: true,
    maintenance_interval_days: 60
  }
];

// 🌱 **تابع Seed کردن داده‌ها**
export async function seedDatabase() {
  try {
    console.log('🌱 شروع Seed کردن داده‌های پایه...');

    // 1. Seed کردن روش‌های صید
    console.log('📊 Seed کردن روش‌های صید...');
    for (const method of defaultFishingMethods) {
      const existing = await FishingMethod.findOne({ name: method.name });
      if (!existing) {
        await new FishingMethod(method).save();
        console.log(`✅ روش صید "${method.name}" اضافه شد`);
      }
    }

    // 2. Seed کردن انواع شناور
    console.log('🚤 Seed کردن انواع شناور...');
    const fishingMethods = await FishingMethod.find({});
    
    for (const boatType of defaultBoatTypes) {
      const existing = await BoatType.findOne({ name: boatType.name });
      if (!existing) {
        // اضافه کردن روش‌های صید مناسب برای هر نوع شناور
        const suitableMethods = fishingMethods.map(m => m._id);
        
        await new BoatType({
          ...boatType,
          suitable_methods: suitableMethods
        }).save();
        console.log(`✅ نوع شناور "${boatType.name}" اضافه شد`);
      }
    }

    // 3. Seed کردن ابزارهای صید
    console.log('🛠️ Seed کردن ابزارهای صید...');
    for (const tool of defaultFishingTools) {
      const existing = await FishingTool.findOne({ name: tool.name });
      if (!existing) {
        // اضافه کردن روش‌های صید سازگار
        const compatibleMethods = fishingMethods
          .filter(m => tool.name.includes('چیرآپ') ? m.name === 'چیرآپ' : true)
          .map(m => m._id);
        
        await new FishingTool({
          ...tool,
          compatible_methods: compatibleMethods
        }).save();
        console.log(`✅ ابزار صید "${tool.name}" اضافه شد`);
      }
    }

    console.log('🎉 Seed کردن داده‌های پایه با موفقیت تکمیل شد!');
    
    // آمار نهایی
    const stats = {
      fishing_methods: await FishingMethod.countDocuments(),
      boat_types: await BoatType.countDocuments(),
      fishing_tools: await FishingTool.countDocuments()
    };
    
    console.log('📊 آمار داده‌های موجود:');
    console.log(`   • روش‌های صید: ${stats.fishing_methods}`);
    console.log(`   • انواع شناور: ${stats.boat_types}`);
    console.log(`   • ابزارهای صید: ${stats.fishing_tools}`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ خطا در Seed کردن داده‌ها:', error);
    throw error;
  }
}

// 🗑️ **تابع پاک کردن تمام داده‌ها (برای development)**
export async function clearDatabase() {
  try {
    console.log('🗑️ پاک کردن تمام داده‌ها...');
    
    await Promise.all([
      FishingMethod.deleteMany({}),
      BoatType.deleteMany({}),
      FishingTool.deleteMany({})
    ]);
    
    console.log('✅ تمام داده‌ها پاک شدند');
  } catch (error) {
    console.error('❌ خطا در پاک کردن داده‌ها:', error);
    throw error;
  }
}

export default { seedDatabase, clearDatabase };
