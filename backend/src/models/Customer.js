import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    customerId: { type: String, default: null, unique: true, sparse: true, index: true },
    customerType: { type: String, enum: ['individual', 'business'], default: 'individual', index: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    region: { type: String, default: '' },
    address: { type: String, default: '' },
    province: { type: String, default: '' },
    district: { type: String, default: '' },
    addressDetail: { type: String, default: '' },
    note: { type: String, default: '' },
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

export const Customer = mongoose.model('Customer', schema);
