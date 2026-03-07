import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, default: '' },
    type: {
      type: String,
      enum: ['maintenance_due', 'maintenance_contract_expired'],
      required: true,
    },
    elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator' },
    contract_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    reference_date: { type: Date }, // ngày tham chiếu (để tránh tạo trùng trong cùng ngày)
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

schema.index({ type: 1, elevator_id: 1, reference_date: 1 });
schema.index({ type: 1, contract_id: 1, reference_date: 1 });

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

export const Notification = mongoose.model('Notification', schema);
