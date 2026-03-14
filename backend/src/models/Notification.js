import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, default: '' },
    type: {
      type: String,
      enum: ['maintenance_schedule_upcoming', 'maintenance_order_assigned', 'maintenance_order_overdue'],
      required: true,
    },
    read: { type: Boolean, default: false },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator' },
    contract_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    maintenance_schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceSchedule' },
    maintenance_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceOrder' },
    reference_date: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

schema.index({ type: 1, maintenance_schedule_id: 1, reference_date: 1, user_id: 1 }, { unique: true });
schema.index({ read: 1, createdAt: -1 });

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
