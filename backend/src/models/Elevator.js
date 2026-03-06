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
