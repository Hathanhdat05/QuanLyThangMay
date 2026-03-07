import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    elevatorId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: '' },
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    capacity: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    description: { type: String, default: '' },
    image_url: { type: String, default: '' },
    maintenance_start_date: { type: Date, default: null },
    maintenance_end_date: { type: Date, default: null },
    maintenance_months: { type: Number, default: null },
    maintenance_frequency_per_month: { type: Number, default: 1, min: 1, max: 36 }, // tháng/lần (số tháng giữa mỗi lần bảo trì)
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

schema.virtual('id').get(function () {
  return this._id?.toHexString();
});
schema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toHexString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Elevator = mongoose.model('Elevator', schema);
