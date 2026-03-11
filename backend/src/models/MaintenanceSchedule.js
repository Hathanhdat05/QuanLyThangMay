import mongoose from 'mongoose';
import { toDateOnly } from '../utils/dateOnly.js';

const schema = new mongoose.Schema(
  {
    contract_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator', required: true, index: true },
    scheduled_date: {
      type: String,
      required: true,
      index: true,
      set: (value) => toDateOnly(value),
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    title: { type: String, default: '' },
    status: { type: String, enum: ['planned', 'completed', 'cancelled'], default: 'planned' },
    contract_number: { type: String, default: '' },
    elevator_name: { type: String, default: '' },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customer_name: { type: String, default: '' },
    google_calendar_event_id: { type: String, default: '', index: true },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

schema.index({ contract_id: 1, elevator_id: 1, scheduled_date: 1 }, { unique: true });

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

export const MaintenanceSchedule = mongoose.model('MaintenanceSchedule', schema);
