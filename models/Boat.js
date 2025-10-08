import mongoose from "mongoose";

const boatSchema = new mongoose.Schema({
  boat_name: { type: String, required: true },
  boat_code: { type: String, required: true },
  registration_date: { type: String, default: null },
  documents: { type: String, default: null },
  fuel_quota: { type: String, default: null },
  boat_type_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BoatType",
    default: null
  },
  fishing_method_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FishingMethod",
    default: null
  },
  status: { type: Number, default: 0 }, // 0: pending, 1: active, 2: inactive, etc.
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  captain_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  installed_tools: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  invoice_period: { type: String, default: null },
  settlement_period: { type: String, default: null },
  min_crew: { type: Number, default: null },
  max_crew: { type: Number, default: null },
  synced: { type: Number, default: 0 }
}, { timestamps: true });

// ایندکس‌های مهم برای performance و business logic
boatSchema.index({ boat_code: 1, fishing_method_id: 1 }, { unique: true }); // کلید اصلی
boatSchema.index({ owner_id: 1 });
boatSchema.index({ boat_type_id: 1 });
boatSchema.index({ fishing_method_id: 1 });
boatSchema.index({ status: 1 });
boatSchema.index({ captain_id: 1 });

// Middleware for validation
boatSchema.pre('save', function(next) {
  // اطمینان از اینکه یک شناور برای هر روش صید فقط یکبار ثبت شود
  if (this.isNew || this.isModified('boat_code') || this.isModified('fishing_method_id')) {
    mongoose.model('Boat').findOne({
      boat_code: this.boat_code,
      fishing_method_id: this.fishing_method_id,
      _id: { $ne: this._id }
    }).then(existingBoat => {
      if (existingBoat) {
        const error = new Error(`شناور با کد ${this.boat_code} قبلاً برای این روش صید ثبت شده است`);
        error.code = 'DUPLICATE_BOAT_METHOD';
        return next(error);
      }
      next();
    }).catch(next);
  } else {
    next();
  }
});

const Boat = mongoose.model("Boat", boatSchema);
export default Boat;
