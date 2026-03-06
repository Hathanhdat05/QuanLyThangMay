import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    errorId: { type: String, default: null, unique: true, sparse: true, index: true },
    elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator' },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    contract_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    reported_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['maintenance', 'warranty'], default: 'maintenance' },
    status: { type: String, enum: ['pending', 'in_progress', 'resolved', 'closed'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    reported_date: { type: Date, default: Date.now },
    scheduled_date: { type: Date },
    completed_date: { type: Date },
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

export const ErrorReport = mongoose.model('ErrorReport', schema);
