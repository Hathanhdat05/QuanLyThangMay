import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, default: 0 },
    unit: { type: String, default: 'cái' },
    specifications: { type: String, default: '' },
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

export const Product = mongoose.model('Product', schema);
